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
