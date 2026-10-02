const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
    ...options,
  }).finally(() => clearTimeout(timer))
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.detail ?? 'API error'), { status: res.status })
  }
  return res.json()
}

export interface Customer {
  id: number
  number: number
  name: string
  phone: string
  status: 'waiting' | 'called'
  position: number
  registered_at: string
  called_at: string | null
  already_registered?: boolean
}

export interface QueueStatus {
  waiting_count: number
  called_count: number
  max_count: number
  is_full: boolean
  is_open: boolean
}

export interface QueueSettings {
  max_count: number
  is_open: boolean
  registration_token: string
}

export const api = {
  getQueueStatus: ()                          => request<QueueStatus>('/queue/status/'),
  register: (name: string, phone: string, deviceId: string, pushSub?: object | null, token?: string) =>
    request<Customer>('/register/', {
      method: 'POST',
      body: JSON.stringify({ name, phone, device_id: deviceId, push_subscription: pushSub ?? null, token: token ?? '' }),
    }),
  getCustomer:       (number: number)          => request<Customer>(`/customer/${number}/`),
  cancelRegistration:(number: number)          => request(`/customer/${number}/cancel/`, { method: 'DELETE' }),
  saveSubscription:  (number: number, sub: object) =>
    request(`/customer/${number}/subscription/`, {
      method: 'POST',
      body: JSON.stringify({ subscription: sub }),
    }),
  getAdminCustomers: ()                       => request<Customer[]>('/admin/customers/'),
  callNext:       ()                          => request<Customer[]>('/admin/call/', { method: 'POST' }),
  getSettings:    ()                          => request<QueueSettings>('/admin/settings/'),
  updateSettings: (maxCount: number)          =>
    request<QueueSettings>('/admin/settings/', {
      method: 'PUT',
      body: JSON.stringify({ max_count: maxCount }),
    }),
  openRegistration:  () => request<QueueSettings>('/admin/open/',  { method: 'POST' }),
  closeRegistration: () => request<QueueSettings>('/admin/close/', { method: 'POST' }),
  reset: () => request('/admin/reset/', { method: 'POST' }),
}

// ─────────────────────────────────────────────
//  抽選 (Lottery) — 待ち番号システムとは独立
// ─────────────────────────────────────────────
export interface Store {
  id: number
  name: string
  code: string
}

// 顧客向け明細書: 固有番号(entry_no)は絶対に含まれない
export interface Receipt {
  public_token: string
  store_name: string
  name: string
  phone: string
  birthdate: string
  children_count: number
  registered_at: string
}

export interface LotteryStatus {
  store: string
  store_name: string
  is_open: boolean
}

// 管理者向け: 固有番号(entry_no)を含む
export interface ApplicantAdmin {
  entry_no: number
  public_token: string
  name: string
  phone: string
  birthdate: string
  children_count: number
  is_child: boolean
  is_winner: boolean
  notified_at: string | null
  picked_up_at: string | null
  registered_at: string
}

export interface AdminApplicants {
  store: string
  store_name: string
  is_open: boolean
  registration_token: string
  max_per_phone: number
  count: number
  applicants: ApplicantAdmin[]
}

export interface ImportResult {
  marked: number
  total_winners: number
  unsent: number
  not_found: number[]
}

export interface SendSmsResult {
  target: number      // 発送件数（＝重複排除した番号数）
  sent: number
  failed: number
  recipients: number  // 含まれる当選者数（参考）
}

// 당첨 SMS 기본 문구 (관리자가 편집 가능)
// {이름} = 당첨자 성명(수신자별 자동 치환), {매장} = 매장명
export const DEFAULT_WINNER_SMS =
  `[Web발신]
[포켓몬카드샵 {매장}]
「30th CELEBRATION」 추첨 판매 당첨 안내

■ 당첨자: {이름} 님

당첨을 축하드립니다!
위에 기재된 당첨자 성명을 확인해 주세요. 상품은 당첨자 본인이 직접 방문하셔야 구매하실 수 있습니다.

※ 자녀가 당첨된 경우, 당첨된 자녀가 직접 방문해야 합니다. 보호자만 방문하시면 구매하실 수 없습니다.

■ 구매 기간
9월 28일(월)~10월 4일(일)
매일 오후 2시~밤 9시

■ 판매 조건
겉박스를 완전히 제거한 후 팩만 전달합니다.
대리 구매 및 기한 이후 구매는 불가합니다.

참여해 주셔서 감사합니다.`

export interface LotteryRegisterInput {
  store: string
  token: string
  name: string
  phone: string
  birthdate: string
  children_count: number
  device_id: string
}

export const lotteryApi = {
  getStores:    ()             => request<Store[]>('/lottery/stores/'),
  getStatus:    (code: string) => request<LotteryStatus>(`/lottery/status/${code}/`),
  register:     (input: LotteryRegisterInput) =>
    request<Receipt>('/lottery/register/', { method: 'POST', body: JSON.stringify(input) }),
  getReceipt:   (token: string) => request<Receipt>(`/lottery/receipt/${token}/`),
  cancel:       (token: string) => request(`/lottery/receipt/${token}/cancel/`, { method: 'DELETE' }),

  getApplicants: (code: string) => request<AdminApplicants>(`/lottery/admin/${code}/applicants/`),
  setPickup:     (code: string, entryNo: number, pickedUp: boolean) =>
    request(`/lottery/admin/${code}/applicant/${entryNo}/pickup/`, {
      method: 'POST',
      body: JSON.stringify({ picked_up: pickedUp }),
    }),
  open:          (code: string) => request(`/lottery/admin/${code}/open/`,  { method: 'POST' }),
  close:         (code: string) => request(`/lottery/admin/${code}/close/`, { method: 'POST' }),
  reset:         (code: string) => request(`/lottery/admin/${code}/reset/`, { method: 'POST' }),

  // xlsx ダウンロード（blob）
  exportUrl: (code: string) => `${BASE_URL}/lottery/admin/${code}/export/`,

  // xlsx アップロード（当選マークの取込のみ。SMSは送らない）
  async importWinners(code: string, file: File): Promise<ImportResult> {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE_URL}/lottery/admin/${code}/import/`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw Object.assign(new Error(err.detail ?? 'API error'), { status: res.status })
    }
    return res.json()
  },

  // 当選者（未送信）へ、入力した文面でSMS送信
  sendSms: (code: string, message: string) =>
    request<SendSmsResult>(`/lottery/admin/${code}/send-sms/`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
}
