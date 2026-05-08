'use client'

import { useState } from 'react'
import CustomerFrame, { type Lang } from '@/components/CustomerFrame'

export default function FullPage() {
  const [lang, setLang] = useState<Lang>('ko')

  return (
    <CustomerFrame lang={lang} onLangChange={setLang}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 'var(--sp4)',
      }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 'var(--sp2)' }}>😔</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--n900)' }}>
          {lang === 'ko' ? '죄송합니다.' : 'Sorry.'}
        </h1>
        <p style={{
          fontSize: '0.9375rem', color: 'var(--n500)',
          lineHeight: 1.75, maxWidth: 280,
        }}>
          {lang === 'ko'
            ? <>현재 대기 등록이 마감되었습니다.<br />빠른 시일 내에 다시 방문해주세요.</>
            : <>Registration is currently closed.<br />Please visit us again soon.</>}
        </p>
      </div>
    </CustomerFrame>
  )
}
