'use client'

import { useState, use } from 'react'
import CustomerFrame, { type Lang } from '@/components/CustomerFrame'

interface Props {
  params: Promise<{ id: string }>
}

export default function AlreadyCalledPage({ params }: Props) {
  const [lang, setLang] = useState<Lang>('ko')
  const { id: customerNumber } = use(params)

  return (
    <CustomerFrame lang={lang} onLangChange={setLang}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

        <div style={{
          width: 68, height: 68,
          background: 'oklch(95% 0.05 25)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 'var(--sp6)',
          color: 'oklch(55% 0.18 25)',
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <p style={{
          fontSize: 11, fontWeight: 700, color: 'var(--n400)',
          letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 'var(--sp3)',
        }}>
          {lang === 'ko' ? '내 번호' : 'My Number'}
        </p>

        <div style={{
          fontSize: '5rem', fontWeight: 900, color: 'var(--n300)',
          lineHeight: 1, letterSpacing: '-0.04em',
          fontVariantNumeric: 'tabular-nums',
          marginBottom: 'var(--sp8)',
        }}>
          #{customerNumber}
        </div>

        <h1 style={{
          fontSize: '1.25rem', fontWeight: 800, color: 'var(--n900)',
          lineHeight: 1.5, marginBottom: 'var(--sp4)',
        }}>
          {lang === 'ko'
            ? '이미 호출된 고객님입니다.'
            : 'You have already been called.'}
        </h1>

        <p style={{ fontSize: '0.9375rem', color: 'var(--n600)', lineHeight: 1.75, marginBottom: 'var(--sp3)' }}>
          {lang === 'ko'
            ? '문의가 있으신 경우 카운터로 와주세요.'
            : 'If you have any questions, please come to the counter.'}
        </p>

        <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'oklch(55% 0.18 25)' }}>
          {lang === 'ko' ? '재등록은 불가합니다.' : 'Re-registration is not allowed.'}
        </p>

      </div>
    </CustomerFrame>
  )
}
