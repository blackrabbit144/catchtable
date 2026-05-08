'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import CustomerFrame, { type Lang } from '@/components/CustomerFrame'
import { api } from '@/lib/api'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [lang, setLang]       = useState<Lang>('ko')
  const [name, setName]       = useState('')
  const [phone, setPhone]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [blocked, setBlocked] = useState<'closed' | 'full' | null>(null)

  useEffect(() => {
    if (!token) return
    const saved = localStorage.getItem('my_queue_number')
    if (saved) { router.replace(`/wait/${saved}`); return }
    api.getQueueStatus().then(s => {
      if (!s.is_open) setBlocked('closed')
      else if (s.is_full) setBlocked('full')
    }).catch(() => {})
  }, [token, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setLoading(true)
    setError('')
    try {
      const customer = await api.register(name.trim(), phone.trim(), undefined, token)
      localStorage.setItem('my_queue_number', String(customer.number))
      router.push(`/wait/${customer.number}`)
    } catch (err: unknown) {
      const status = (err as { status?: number }).status
      if (status === 409) router.push('/full')
      else if (status === 403) setBlocked('closed')
      else setError(lang === 'ko' ? '오류가 발생했습니다. 다시 시도해주세요.' : 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <CustomerFrame lang={lang} onLangChange={setLang}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 'var(--sp4)' }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>🕐</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--n900)' }}>
            {lang === 'ko' ? '현재 접수 중이 아닙니다.' : 'Registration is not open.'}
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--n500)', lineHeight: 1.75, maxWidth: 280 }}>
            {lang === 'ko' ? '점포의 QR코드를 다시 스캔해주세요.' : 'Please scan the QR code at the store.'}
          </p>
        </div>
      </CustomerFrame>
    )
  }

  if (blocked === 'full') {
    router.replace('/full')
    return null
  }

  if (blocked === 'closed') {
    return (
      <CustomerFrame lang={lang} onLangChange={setLang}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 'var(--sp4)' }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>🕐</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--n900)' }}>
            {lang === 'ko' ? '현재 접수 중이 아닙니다.' : 'Registration is not open.'}
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--n500)', lineHeight: 1.75, maxWidth: 280 }}>
            {lang === 'ko' ? '점포의 QR코드를 다시 스캔해주세요.' : 'Please scan the QR code at the store.'}
          </p>
        </div>
      </CustomerFrame>
    )
  }

  return (
    <CustomerFrame lang={lang} onLangChange={setLang}>
      <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--n900)', lineHeight: 1.2, marginBottom: 'var(--sp2)' }}>
          {lang === 'ko' ? '대기 등록' : 'Join Waitlist'}
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--n500)', marginBottom: 'var(--sp8)', lineHeight: 1.6 }}>
          {lang === 'ko'
            ? '정보를 입력하시면 순서가 되면 알려드립니다.'
            : "Enter your info and we'll notify you when it's your turn."}
        </p>

        <div className="fields">
          <div className="field">
            <label>{lang === 'ko' ? '이름' : 'Name'}</label>
            <input type="text" placeholder={lang === 'ko' ? '홍길동' : 'John Doe'}
              value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>{lang === 'ko' ? '전화번호' : 'Phone Number'}</label>
            <input type="tel" placeholder="010-0000-0000"
              value={phone} onChange={e => setPhone(e.target.value)} required />
          </div>
        </div>

        {error && (
          <p style={{ fontSize: '0.875rem', color: 'oklch(55% 0.18 25)', marginBottom: 'var(--sp4)' }}>
            {error}
          </p>
        )}

        <button className="btnMain" type="submit" disabled={loading}>
          {loading ? (lang === 'ko' ? '등록 중...' : 'Registering...') : (lang === 'ko' ? '등록하기' : 'Register')}
        </button>
      </form>
    </CustomerFrame>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
