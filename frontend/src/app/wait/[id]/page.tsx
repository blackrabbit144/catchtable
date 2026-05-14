'use client'

import { useState, use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CustomerFrame, { type Lang } from '@/components/CustomerFrame'
import { api } from '@/lib/api'

interface Props {
  params: Promise<{ id: string }>
}

export default function WaitPage({ params }: Props) {
  const router = useRouter()
  const { id } = use(params)
  const customerNumber = parseInt(id)

  const [lang, setLang]             = useState<Lang>('ko')
  const [position, setPosition]     = useState<number | null>(null)
  const [registeredAt, setRegisteredAt] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const MINUTES_PER_PERSON = 5

  async function handleCancel() {
    const msg = lang === 'ko'
      ? '등록을 취소하시겠습니까?\n취소 후 다시 QR코드를 스캔하여 재등록할 수 있습니다.'
      : 'Cancel your registration?\nYou can re-register by scanning the QR code again.'
    if (!confirm(msg)) return
    setCancelling(true)
    try {
      await api.cancelRegistration(customerNumber)
    } catch { /* already deleted or called — proceed anyway */ }
    localStorage.removeItem('my_queue_number')
    router.replace('/')
  }

  useEffect(() => {
    async function poll() {
      try {
        const data = await api.getCustomer(customerNumber)
        if (data.status === 'called') {
          localStorage.removeItem('my_queue_number')
          router.replace(`/called/${customerNumber}`)
          return
        }
        setPosition(data.position)
        setRegisteredAt(prev => prev ?? data.registered_at)
      } catch (err: unknown) {
        if ((err as { status?: number }).status === 404) {
          localStorage.removeItem('my_queue_number')
          router.replace('/')
        }
      }
    }

    async function setupPush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        const keyBytes = Uint8Array.from(
          atob(vapidKey.replace(/-/g, '+').replace(/_/g, '/')),
          c => c.charCodeAt(0)
        )
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes,
        })
        await api.saveSubscription(customerNumber, sub.toJSON())
      } catch {
        // 通知許可拒否またはブラウザ非対応は無視
      }
    }

    setupPush()
    poll()
    const timer = setInterval(poll, 10000)
    return () => clearInterval(timer)
  }, [customerNumber, router])

  return (
    <CustomerFrame lang={lang} onLangChange={setLang}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: 11, fontWeight: 700, color: 'var(--n400)',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 'var(--sp3)',
        }}>
          {lang === 'ko' ? '내 번호' : 'My Number'}
        </p>

        <div style={{
          fontSize: '6rem', fontWeight: 900, color: 'var(--y400)',
          lineHeight: 1, letterSpacing: '-0.04em',
          fontVariantNumeric: 'tabular-nums',
          marginBottom: 'var(--sp8)',
        }}>
          #{customerNumber}
        </div>

        <div style={{
          width: '100%',
          background: 'var(--b50)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--sp6) var(--sp8)',
          marginBottom: 'var(--sp4)',
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--b400)', marginBottom: 'var(--sp2)' }}>
            {lang === 'ko' ? '현재 대기 순번' : 'Current Position'}
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
            <span style={{
              fontSize: '3.5rem', fontWeight: 900, color: 'var(--b500)',
              lineHeight: 1, fontVariantNumeric: 'tabular-nums',
            }}>
              {position ?? '—'}
            </span>
            {position !== null && (
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--b400)' }}>
                {lang === 'ko' ? '번째' : 'rd in line'}
              </span>
            )}
          </div>
        </div>

        <div style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--sp3)',
          marginBottom: 'var(--sp6)',
        }}>
          <div style={{
            background: 'var(--n50)',
            borderRadius: 'var(--r-md)',
            padding: 'var(--sp4) var(--sp4)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--n400)', marginBottom: 'var(--sp1)' }}>
              {lang === 'ko' ? '내 앞 대기' : 'Ahead of you'}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
              <span style={{
                fontSize: '1.8rem', fontWeight: 900, color: 'var(--n600)',
                lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              }}>
                {position !== null ? position - 1 : '—'}
              </span>
              {position !== null && (
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--n400)' }}>
                  {lang === 'ko' ? '명' : 'ppl'}
                </span>
              )}
            </div>
          </div>

          <div style={{
            background: 'var(--n50)',
            borderRadius: 'var(--r-md)',
            padding: 'var(--sp4) var(--sp4)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--n400)', marginBottom: 'var(--sp1)' }}>
              {lang === 'ko' ? '예상 대기 시간' : 'Est. wait'}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
              <span style={{
                fontSize: '1.8rem', fontWeight: 900, color: 'var(--n600)',
                lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              }}>
                {position !== null ? (position - 1) * MINUTES_PER_PERSON : '—'}
              </span>
              {position !== null && (
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--n400)' }}>
                  {lang === 'ko' ? '분' : 'min'}
                </span>
              )}
            </div>
          </div>
        </div>

        {registeredAt && (
          <p style={{ fontSize: '0.8rem', color: 'var(--n300)', marginBottom: 'var(--sp2)' }}>
            {lang === 'ko' ? '등록 시간: ' : 'Registered: '}
            {new Date(registeredAt).toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', {
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        )}

        <p style={{ fontSize: '0.875rem', color: 'var(--n400)', lineHeight: 1.7 }}>
          {lang === 'ko'
            ? <>순서가 되면 알림을 보내드립니다.<br />알림을 허용해 주세요.</>
            : <>You&apos;ll be notified when it&apos;s your turn.<br />Please allow notifications.</>}
        </p>

        <button
          onClick={handleCancel}
          disabled={cancelling}
          style={{
            marginTop: 'var(--sp8)', background: 'none', border: 'none',
            fontSize: '0.8125rem', color: 'var(--n400)', cursor: 'pointer',
            textDecoration: 'underline', fontFamily: 'inherit',
          }}
        >
          {lang === 'ko' ? '등록 취소' : 'Cancel registration'}
        </button>
      </div>
    </CustomerFrame>
  )
}
