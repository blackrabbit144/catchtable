/**
 * catchtable 負荷テスト
 *
 * フェーズ1: 100VUが同時に登録（並列）
 * フェーズ2: 100人全員がwait画面で10秒ごとにポーリング（60秒間）
 * teardown: 全員を呼び出してSMSをシミュレート → データリセット
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// ── カスタムメトリクス ──────────────────────────────────────────────
const registerErrors = new Counter('register_errors');
const pollErrors     = new Counter('poll_errors');
const registerTime   = new Trend('register_duration', true);
const pollTime       = new Trend('poll_duration', true);

// ── テスト設定 ────────────────────────────────────────────────────
const BASE_URL    = 'http://localhost:8000';
const TOTAL_USERS = 150;
const POLL_INTERVAL_SEC = 10;  // wait画面のポーリング間隔（実際と同じ）
const POLL_DURATION_SEC = 60;  // ポーリングを何秒間続けるか

export const options = {
  scenarios: {
    // フェーズ1: 100人が一斉に登録（テスト開始直後）
    registration: {
      executor: 'shared-iterations',
      exec: 'registerScenario',  // 実行する関数を指定
      vus: 150,
      iterations: TOTAL_USERS,
      maxDuration: '30s',
      tags: { phase: 'register' },
    },

    // フェーズ2: 100人が10秒ごとにポーリング（登録完了後に開始）
    polling: {
      executor: 'per-vu-iterations',  // 各VUが独立して繰り返す
      exec: 'pollScenario',           // 実行する関数を指定
      vus: 150,
      iterations: Math.ceil(POLL_DURATION_SEC / POLL_INTERVAL_SEC), // 1VUあたり6回
      maxDuration: `${POLL_DURATION_SEC + 10}s`,
      startTime: '10s',  // 登録フェーズが終わってから開始
      tags: { phase: 'poll' },
    },
  },

  thresholds: {
    // 登録: 95%が500ms以内、エラー率5%未満
    'http_req_duration{phase:register}': ['p(95)<500'],
    'http_req_failed{phase:register}':   ['rate<0.05'],
    'register_errors':                   ['count<5'],

    // ポーリング: 95%が300ms以内（軽いGETなので厳しめ）、エラー率1%未満
    'http_req_duration{phase:poll}':     ['p(95)<300'],
    'http_req_failed{phase:poll}':       ['rate<0.01'],
    'poll_errors':                       ['count<10'],
  },
};

// ── setup(): テスト開始前に1回だけ実行 ────────────────────────────
export function setup() {
  // 上限を300に設定
  const settingsRes = http.put(
    `${BASE_URL}/api/admin/settings/`,
    JSON.stringify({ max_count: 200 }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(settingsRes, { 'settings updated': (r) => r.status === 200 });

  // 受付開始
  const openRes = http.post(`${BASE_URL}/api/admin/open/`);
  check(openRes, { 'registration opened': (r) => r.status === 200 });

  const token = openRes.json('registration_token');
  console.log(`✅ Token: ${token}`);

  return { token };
}

// ── フェーズ1: 登録 ───────────────────────────────────────────────
// シナリオ名が 'registration' のときに呼ばれる
// k6はシナリオを exec で振り分けられないため、
// __ENV.SCENARIO_NAME または開始時刻で判断する
// → ここでは options.scenarios の executor で分離しているため
//    default関数をシナリオごとに分ける必要がある

// k6はシナリオごとに別関数を指定できる（exec オプション）
export function registerScenario(data) {
  const { token } = data;
  const vuId     = __VU;
  const phone    = `0100000${String(vuId).padStart(4, '0')}`;

  const payload = JSON.stringify({
    name:      `테스트유저${vuId}`,
    phone:     phone,
    device_id: `device-test-${vuId}`,
    token:     token,
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
    tags:    { phase: 'register' },
  };

  const start = Date.now();
  const res   = http.post(`${BASE_URL}/api/register/`, payload, params);
  registerTime.add(Date.now() - start);

  const ok = check(res, {
    'status is 201': (r) => r.status === 201,
    'has number':    (r) => r.json('number') !== undefined,
  });

  if (!ok) {
    registerErrors.add(1);
    console.error(`❌ VU${vuId} 登録失敗: ${res.status} ${res.body}`);
  } else {
    console.log(`✅ VU${vuId} → #${res.json('number')} 登録完了`);
  }
}

// ── フェーズ2: ポーリング ─────────────────────────────────────────
// VU番号からcustomer numberを逆算（登録時と同じロジック）
export function pollScenario() {
  const vuId           = __VU;
  // k6は全シナリオ合計でVUに連番を振る（登録が1〜100を使うと、ポーリングは101〜200になる）
  // % TOTAL_USERS で1〜100に正規化する
  const customerNumber = ((__VU - 1) % TOTAL_USERS) + 1;

  const params = { tags: { phase: 'poll' } };

  const start = Date.now();
  const res   = http.get(`${BASE_URL}/api/customer/${customerNumber}/`, params);
  pollTime.add(Date.now() - start);

  const ok = check(res, {
    'poll 200 or 404': (r) => r.status === 200 || r.status === 404,
    'response time ok': (r) => r.timings.duration < 300,
  });

  if (!ok) {
    pollErrors.add(1);
    console.error(`❌ VU${vuId} ポーリング失敗: ${res.status}`);
  }

  // 実際のwait画面と同じ間隔で待機
  sleep(POLL_INTERVAL_SEC);
}

// ── teardown(): 全員呼び出し → リセット ──────────────────────────
export function teardown() {
  console.log('\n📞 呼び出しフェーズ開始...');
  let callCount = 0;

  for (let i = 0; i < TOTAL_USERS; i++) {
    const res = http.post(`${BASE_URL}/api/admin/call/`);
    if (res.status === 200) {
      const called = res.json();
      if (called && called.length > 0) {
        callCount++;
      }
    } else if (res.status === 400) {
      break;
    }
  }

  console.log(`✅ 呼び出し完了: ${callCount}件 (SMS送信スキップ済み)`);

  http.post(`${BASE_URL}/api/admin/reset/`);
  console.log('🗑️  テストデータをリセットしました');
}
