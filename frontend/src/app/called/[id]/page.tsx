'use client'

import { useState, use } from 'react'
import CustomerFrame, { type Lang } from '@/components/CustomerFrame'

interface Props {
  params: Promise<{ id: string }>
}

export default function CalledPage({ params }: Props) {
  const [lang, setLang] = useState<Lang>('ko')
  const { id: customerNumber } = use(params)

  return (
    <CustomerFrame lang={lang} onLangChange={setLang}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          width: 68, height: 68,
          background: 'var(--y100)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 'var(--sp6)',
          color: 'var(--y500)',
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 style={{
          fontSize: '1.4rem', fontWeight: 800, color: 'var(--n900)',
          lineHeight: 1.35, marginBottom: 'var(--sp4)',
        }}>
          {lang === 'ko'
            ? '포켓몬카드샵 대기순번이 왔어요!'
            : 'Your turn has arrived!'}
        </h1>

        <div style={{
          fontSize: '1.75rem', fontWeight: 900, color: 'var(--y400)',
          marginBottom: 'var(--sp6)', fontVariantNumeric: 'tabular-nums',
        }}>
          {lang === 'ko' ? `손님번호 #${customerNumber}` : `Customer Number #${customerNumber}`}
        </div>

        <p style={{
          fontSize: '1rem', color: 'var(--n700)',
          lineHeight: 1.75, marginBottom: 'var(--sp6)',
        }}>
          {lang === 'ko'
            ? <>오래 기다리셨습니다.<br />점포로 와주시면 구매 안내해드리겠습니다.</>
            : <>Thank you for your patience.<br />Please come to the store and we will assist you.</>}
        </p>

        <div style={{
          background: 'var(--n50)',
          borderRadius: 'var(--r-sm)',
          padding: 'var(--sp4)',
          marginBottom: 'var(--sp6)',
        }}>
          <p style={{
            fontSize: '0.8125rem', fontWeight: 800, color: 'var(--n700)',
            marginBottom: 'var(--sp2)',
          }}>
            {lang === 'ko' ? '주의사항' : 'Please Note'}
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--n500)', lineHeight: 1.7 }}>
            {lang === 'ko'
              ? <>알림 후 10분안으로 도착해주시면 감사하겠습니다.<br />제한시간이 넘어가면 고객님 부재중으로 간주되어 다음 순번으로 넘어갑니다.</>
              : <>Please arrive within 10 minutes of receiving this notification.<br />If you do not arrive in time, your number will be passed to the next customer.</>}
          </p>
        </div>

        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--n400)' }}>
          {lang === 'ko' ? '포켓몬카드샵 드림.' : 'Pokemon Card Shop'}
        </p>
      </div>
    </CustomerFrame>
  )
}
