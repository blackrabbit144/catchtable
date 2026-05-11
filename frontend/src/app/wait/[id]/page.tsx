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

  const [lang, setLang]         = useState<Lang>('ko')
  const [position, setPosition] = useState<number | null>(null)

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
    const timer = setInterval(poll, 5000)
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
          marginBottom: 'var(--sp6)',
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

        <p style={{ fontSize: '0.875rem', color: 'var(--n400)', lineHeight: 1.7 }}>
          {lang === 'ko'
            ? <>순서가 되면 알림을 보내드립니다.<br />알림을 허용해 주세요.</>
            : <>You&apos;ll be notified when it&apos;s your turn.<br />Please allow notifications.</>}
        </p>
      </div>
    </CustomerFrame>
  )
}
