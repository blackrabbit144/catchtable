const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
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
}

export interface QueueStatus {
  waiting_count: number
  called_count: number
  max_count: number
  is_full: boolean
}

export interface QueueSettings {
  max_count: number
}

export const api = {
  getQueueStatus: ()                          => request<QueueStatus>('/queue/status/'),
  register:       (name: string, phone: string, pushSub?: object | null) =>
    request<Customer>('/register/', {
      method: 'POST',
      body: JSON.stringify({ name, phone, push_subscription: pushSub ?? null }),
    }),
  getCustomer:       (number: number)          => request<Customer>(`/customer/${number}/`),
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
  reset: () => request('/admin/reset/', { method: 'POST' }),
}
