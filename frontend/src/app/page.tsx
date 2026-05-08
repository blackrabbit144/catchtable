'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CustomerFrame, { type Lang } from '@/components/CustomerFrame'
import { api } from '@/lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const [lang, setLang]       = useState<Lang>('ko')
  const [name, setName]       = useState('')
  const [phone, setPhone]     = useState('')
  const [loading, setLoading] = useState(false)
  const [isFull, setIsFull]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    api.getQueueStatus().then(s => { if (s.is_full) setIsFull(true) }).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setLoading(true)
    setError('')
    try {
      const customer = await api.register(name.trim(), phone.trim())
      router.push(`/wait/${customer.number}`)
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 409) {
        router.push('/full')
      } else {
        setError(lang === 'ko' ? '오류가 발생했습니다. 다시 시도해주세요.' : 'An error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (isFull) {
    router.replace('/full')
    return null
  }

  return (
    <CustomerFrame lang={lang} onLangChange={setLang}>
      <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h1 style={{
          fontSize: '2rem', fontWeight: 800, color: 'var(--n900)',
          lineHeight: 1.2, marginBottom: 'var(--sp2)',
        }}>
          {lang === 'ko' ? '대기 등록' : 'Join Waitlist'}
        </h1>
        <p style={{
          fontSize: '0.9375rem', color: 'var(--n500)',
          marginBottom: 'var(--sp8)', lineHeight: 1.6,
        }}>
          {lang === 'ko'
            ? '정보를 입력하시면 순서가 되면 알려드립니다.'
            : "Enter your info and we'll notify you when it's your turn."}
        </p>

        <div className="fields">
          <div className="field">
            <label>{lang === 'ko' ? '이름' : 'Name'}</label>
            <input
              type="text"
              placeholder={lang === 'ko' ? '홍길동' : 'John Doe'}
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>{lang === 'ko' ? '전화번호' : 'Phone Number'}</label>
            <input
              type="tel"
              placeholder="010-0000-0000"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
            />
          </div>
        </div>

        {error && (
          <p style={{ fontSize: '0.875rem', color: 'oklch(55% 0.18 25)', marginBottom: 'var(--sp4)' }}>
            {error}
          </p>
        )}

        <button className="btnMain" type="submit" disabled={loading}>
          {loading
            ? (lang === 'ko' ? '등록 중...' : 'Registering...')
            : (lang === 'ko' ? '등록하기' : 'Register')}
        </button>
      </form>
    </CustomerFrame>
  )
}
