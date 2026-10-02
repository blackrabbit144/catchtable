'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import CustomerFrame, { type Lang } from '@/components/CustomerFrame'
import { lotteryApi } from '@/lib/api'

const THIS_YEAR = new Date().getFullYear()
// 연도 목록: 올해부터 과거순 (스크롤 + 숫자 입력으로 점프 가능)
const YEARS = Array.from({ length: THIS_YEAR - 1919 }, (_, i) => THIS_YEAR - i)
const pad2 = (n: number) => String(n).padStart(2, '0')

function daysInMonth(year: number, month: number): number {
  if (!year || !month) return 31
  return new Date(year, month, 0).getDate()
}

// 실제 존재하는 날짜인지 검증 (YYYY-MM-DD, 1920~올해)
function isValidBirth(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, day] = s.split('-').map(Number)
  if (y < 1920 || y > THIS_YEAR) return false
  const dt = new Date(y, m - 1, day)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === day
}

function getOrCreateDeviceId(): string {
  const cookieMatch = document.cookie.split('; ').find(row => row.startsWith('device_id='))
  const cookieId = cookieMatch ? cookieMatch.split('=')[1] : null
  const localId  = localStorage.getItem('device_id')
  const id = cookieId || localId || crypto.randomUUID()
  localStorage.setItem('device_id', id)
  document.cookie = `device_id=${id}; max-age=${60 * 60 * 24 * 365}; SameSite=Lax; path=/`
  return id
}

function LotteryForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const store = searchParams.get('store') ?? ''
  const token = searchParams.get('token') ?? ''

  const [lang, setLang]               = useState<Lang>('ko')
  const [storeName, setStoreName]     = useState('')
  const [name, setName]               = useState('')
  const [phone, setPhone]             = useState('')
  const [birthYear, setBirthYear]     = useState('')
  const [birthMonth, setBirthMonth]   = useState('')
  const [birthDay, setBirthDay]       = useState('')
  const [childrenCount, setChildrenCount] = useState(0)
  const [agreed, setAgreed]           = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [blocked, setBlocked]         = useState<'closed' | null>(null)

  const birthdate = birthYear && birthMonth && birthDay
    ? `${birthYear}-${birthMonth}-${birthDay}`
    : ''
  const dayCount = daysInMonth(Number(birthYear), Number(birthMonth))

  function clampDay(y: string, m: string) {
    const max = daysInMonth(Number(y), Number(m))
    if (birthDay && Number(birthDay) > max) setBirthDay(pad2(max))
  }

  useEffect(() => {
    if (!store || !token) return
    lotteryApi.getStatus(store).then(s => {
      setStoreName(s.store_name)
      if (!s.is_open) setBlocked('closed')
    }).catch(() => setBlocked('closed'))
  }, [store, token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    if (!isValidBirth(birthdate)) {
      setError(lang === 'ko'
        ? '생년월일을 올바르게 입력해주세요. (예: 1998-03-15)'
        : 'Please enter a valid date of birth. (e.g. 1998-03-15)')
      return
    }
    setLoading(true)
    setError('')
    try {
      const receipt = await lotteryApi.register({
        store, token,
        name: name.trim(),
        phone: phone.trim(),
        birthdate,
        children_count: childrenCount,
        device_id: getOrCreateDeviceId(),
      })
      router.push(`/lottery/receipt/${receipt.public_token}`)
    } catch (err: unknown) {
      const status  = (err as { status?: number }).status
      const detail  = (err as { message?: string }).message
      if (status === 403) {
        setBlocked('closed')
      } else if (status === 400 && detail === 'duplicate') {
        setError(lang === 'ko'
          ? '이미 등록된 번호입니다. 자녀가 있는 경우 "자녀 동반"을 체크해 주세요.'
          : 'This number is already registered. Check "accompanying child" if you have children.')
      } else if (status === 400 && detail === 'limit') {
        setError(lang === 'ko'
          ? '한 번호당 응모 가능 인원을 초과했습니다.'
          : 'You have exceeded the maximum entries per phone number.')
      } else {
        setError(lang === 'ko' ? '오류가 발생했습니다. 다시 시도해주세요.' : 'An error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!store || !token) {
    return (
      <CustomerFrame lang={lang} onLangChange={setLang}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 'var(--sp4)' }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>🎁</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--n900)' }}>
            {lang === 'ko' ? '추첨 접수가 아닙니다.' : 'Lottery is not open.'}
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--n500)', lineHeight: 1.75, maxWidth: 280 }}>
            {lang === 'ko' ? '매장의 QR코드를 다시 스캔해주세요.' : 'Please scan the QR code at the store.'}
          </p>
        </div>
      </CustomerFrame>
    )
  }

  if (blocked === 'closed') {
    return (
      <CustomerFrame lang={lang} onLangChange={setLang}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 'var(--sp4)' }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>🎁</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--n900)' }}>
            {lang === 'ko' ? '현재 추첨 접수 중이 아닙니다.' : 'Lottery registration is not open.'}
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--n500)', lineHeight: 1.75, maxWidth: 280 }}>
            {lang === 'ko' ? '매장의 QR코드를 다시 스캔해주세요.' : 'Please scan the QR code at the store.'}
          </p>
        </div>
      </CustomerFrame>
    )
  }

  return (
    <CustomerFrame lang={lang} onLangChange={setLang}>
      <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--n900)', lineHeight: 1.2, marginBottom: 'var(--sp2)' }}>
          {lang === 'ko' ? '추첨 응모' : 'Lottery Entry'}
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--n500)', marginBottom: 'var(--sp8)', lineHeight: 1.6 }}>
          {storeName && <><strong>{storeName}</strong><br /></>}
          {lang === 'ko'
            ? '정보를 입력하신 후 명세서를 직원에게 보여주세요.'
            : 'Enter your info and show the statement to the staff.'}
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
          <div className="field">
            <label>{lang === 'ko' ? '생년월일' : 'Date of Birth'}</label>
            {/* 연·월·일 드롭다운: 스크롤로 선택 + 숫자 입력으로 점프, 모바일은 휠 */}
            <div style={{ display: 'flex', gap: 'var(--sp2)' }}>
              <select
                className="birthSel"
                value={birthYear}
                onChange={e => { setBirthYear(e.target.value); clampDay(e.target.value, birthMonth) }}
                style={{ flex: 1.3 }}
                required
              >
                <option value="" disabled>{lang === 'ko' ? '년' : 'Year'}</option>
                {YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>
              <select
                className="birthSel"
                value={birthMonth}
                onChange={e => { setBirthMonth(e.target.value); clampDay(birthYear, e.target.value) }}
                style={{ flex: 1 }}
                required
              >
                <option value="" disabled>{lang === 'ko' ? '월' : 'Mon'}</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
                  <option key={m} value={pad2(m)}>{m}</option>)}
              </select>
              <select
                className="birthSel"
                value={birthDay}
                onChange={e => setBirthDay(e.target.value)}
                style={{ flex: 1 }}
                required
              >
                <option value="" disabled>{lang === 'ko' ? '일' : 'Day'}</option>
                {Array.from({ length: dayCount }, (_, i) => i + 1).map(d =>
                  <option key={d} value={pad2(d)}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 'var(--sp4)' }}>
          <label>{lang === 'ko' ? '동반 자녀 수' : 'Number of children'}</label>
          <select
            className="birthSel"
            value={childrenCount}
            onChange={e => setChildrenCount(Number(e.target.value))}
          >
            {Array.from({ length: 10 }, (_, i) => i).map(n =>
              <option key={n} value={n}>{n === 0 ? (lang === 'ko' ? '없음' : 'None') : `${n}${lang === 'ko' ? '명' : ''}`}</option>)}
          </select>
          <span style={{ fontSize: '0.8125rem', color: 'var(--n500)', lineHeight: 1.6, marginTop: 4 }}>
            {lang === 'ko'
              ? '스마트폰이 없는 자녀는 같은 번호로 함께 응모됩니다. 직원이 현장에서 자녀 동반 여부를 확인합니다.'
              : 'Children without a smartphone are entered under the same number. Staff verify this on site.'}
          </span>
        </div>

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 'var(--sp3)',
          marginBottom: 'var(--sp4)', cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: 3, flexShrink: 0, width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.8125rem', color: 'var(--n600)', lineHeight: 1.6 }}>
            {lang === 'ko'
              ? <>개인정보(이름, 전화번호, 생년월일) 수집·이용에 동의합니다.<br />수집된 정보는 추첨 및 당첨자 SMS 안내 목적으로만 사용되며, 추첨 종료 후 파기됩니다.</>
              : <>I agree to the collection and use of personal information (name, phone, date of birth).<br />Used solely for the lottery and winner SMS, and deleted after the lottery ends.</>}
          </span>
        </label>

        {error && (
          <p style={{ fontSize: '0.875rem', color: 'oklch(55% 0.18 25)', marginBottom: 'var(--sp4)' }}>
            {error}
          </p>
        )}

        <button className="btnMain" type="submit" disabled={loading || !agreed}>
          {loading ? (lang === 'ko' ? '응모 중...' : 'Submitting...') : (lang === 'ko' ? '응모하기' : 'Enter')}
        </button>
      </form>
    </CustomerFrame>
  )
}

export default function LotteryPage() {
  return (
    <Suspense>
      <LotteryForm />
    </Suspense>
  )
}
