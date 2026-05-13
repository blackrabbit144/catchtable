# Catchtable — Backend

Django REST Framework 製の待ち番号管理 API。

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Django 4.2 + Django REST Framework |
| 言語 | Python 3.9 |
| DB | MySQL 8.0（utf8mb4） |
| SMS通知 | Solapi |
| タイムゾーン | Asia/Seoul |

---

## ディレクトリ構成

```
backend/
├── config/
│   ├── settings.py       # 設定（DB・CORS・Solapi を環境変数で管理）
│   ├── urls.py           # ルートURL（/api/ を queue_app に委譲）
│   └── wsgi.py
├── queue_app/
│   ├── models.py         # Customer・QueueSettings モデル
│   ├── serializers.py    # シリアライザー
│   ├── views.py          # API ビュー
│   ├── urls.py           # エンドポイント定義
│   └── migrations/
├── .env                  # 環境変数（git 除外）
└── requirements.txt
```

---

## API エンドポイント

### お客様向け

| メソッド | URL | 説明 |
|---|---|---|
| `GET` | `/api/queue/status/` | 待ち人数・上限・満員・受付状態 |
| `POST` | `/api/register/` | お客様登録（名前・電話番号・device_id・token） |
| `GET` | `/api/customer/{番号}/` | 自分の番号・現在の順番取得 |
| `DELETE` | `/api/customer/{番号}/cancel/` | 登録キャンセル |
| `POST` | `/api/customer/{番号}/subscription/` | Push Subscription を保存 |

### 管理者向け

| メソッド | URL | 説明 |
|---|---|---|
| `GET` | `/api/admin/customers/` | 全お客様リスト取得 |
| `POST` | `/api/admin/call/` | 先頭1人を呼び出し（SMS送信） |
| `GET/PUT` | `/api/admin/settings/` | 上限人数の取得・変更 |
| `POST` | `/api/admin/open/` | 受付開始（全データ削除・トークン発行） |
| `POST` | `/api/admin/close/` | 受付終了 |
| `POST` | `/api/admin/reset/` | 全データ初期化 |

---

## モデル

### Customer

| フィールド | 型 | 説明 |
|---|---|---|
| `number` | IntegerField | 待ち番号（1 から連番・ユニーク） |
| `name` | CharField | 名前 |
| `phone` | CharField | 電話番号（重複チェックあり） |
| `device_id` | CharField | ブラウザ識別ID（二重登録防止） |
| `status` | CharField | `waiting` / `called` |
| `push_subscription` | JSONField | Web Push の Subscription オブジェクト |
| `registered_at` | DateTimeField | 登録日時 |
| `called_at` | DateTimeField | 呼び出し日時 |

`position` プロパティ：自分より前の `waiting` 状態のお客様数 + 1。

### QueueSettings

| フィールド | 型 | 説明 |
|---|---|---|
| `max_count` | IntegerField | 登録上限人数（デフォルト 100） |
| `is_open` | BooleanField | 受付中フラグ |
| `registration_token` | CharField | 登録用トークン（QRコードに埋め込み） |

---

## 環境変数

```env
SECRET_KEY=
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=catchtable
DB_USER=root
DB_PASSWORD=
DB_HOST=127.0.0.1
DB_PORT=3306

CORS_ALLOWED_ORIGINS=http://localhost:3000

SOLAPI_API_KEY=
SOLAPI_API_SECRET=
SOLAPI_SENDER=

# 負荷テスト時にTrueにするとSMS送信をスキップ
LOAD_TEST_MODE=False
```

---

## セットアップ手順

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

mysql -u root -e "CREATE DATABASE catchtable CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
python manage.py migrate
python manage.py runserver 8000
```

---

## 呼び出しロジック

- 待ち状態（`waiting`）のお客様を番号順に1人取得
- `status` を `called` に変更 → `called_at` を記録
- Solapi API経由でSMS送信

SMSメッセージ：
```
[포켓몬카드샵] #{番号}번 고객님, 입장해 주세요.
참고: 이 번호로 전화하셔도 대응하지 않습니다.
```

---

## 二重登録防止

- **電話番号**：ステータス問わず全チェック（最優先）
- **device_id**：ブラウザのlocalStorage+Cookieに保存したランダムUUID（同一ブラウザからの誤操作防止）

---

## 採番の並列安全性

`register()` 内で `transaction.atomic()` + `QueueSettings.select_for_update()` により採番をシリアライズ。100人同時登録でも重複なし（負荷テスト実証済み）。

---

## 負荷テスト

k6スクリプト：`load_test.js`（プロジェクトルート）

```bash
# SMS送信をスキップしてサーバー起動
LOAD_TEST_MODE=True python manage.py runserver

# 別ターミナルで実行
k6 run load_test.js
```

実証済み限界：**100人同時登録＋60秒ポーリング → エラー0件**
