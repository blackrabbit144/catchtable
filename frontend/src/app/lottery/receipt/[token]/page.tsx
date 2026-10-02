'use client'

import { useState, use, useEffect } from 'react'
import CustomerFrame, { type Lang } from '@/components/CustomerFrame'
import { lotteryApi, type Receipt } from '@/lib/api'

interface Props {
  params: Promise<{ token: string }>
}

export default function ReceiptPage({ params }: Props) {
  const { token } = use(params)

  const [lang, setLang]         = useState<Lang>('ko')
  const [receipt, setReceipt]   = useState<Receipt | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    lotteryApi.getReceipt(token)
      .then(setReceipt)
      .catch(() => setNotFound(true))
  }, [token])

  async function handleCancel() {
    const msg = lang === 'ko'
      ? '응모를 취소하시겠습니까?\n(자녀 동반 응모는 함께 취소됩니다)\n취소 후 QR코드를 다시 스캔하여 재응모할 수 있습니다.'
      : 'Cancel your entry?\n(Accompanying children are cancelled too)\nYou can re-enter by scanning the QR code again.'
    if (!confirm(msg)) return
    setCancelling(true)
    try {
      await lotteryApi.cancel(token)
      setCancelled(true)
    } catch {
      alert(lang === 'ko' ? '취소에 실패했습니다. 다시 시도해주세요.' : 'Cancellation failed. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  if (cancelled) {
    return (
      <CustomerFrame lang={lang} onLangChange={setLang}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 'var(--sp4)' }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>🗑️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--n900)' }}>
            {lang === 'ko' ? '응모가 취소되었습니다.' : 'Your entry was cancelled.'}
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--n500)', lineHeight: 1.7, maxWidth: 280 }}>
            {lang === 'ko' ? '다시 응모하시려면 매장의 QR코드를 스캔해주세요.' : 'To enter again, scan the store QR code.'}
          </p>
        </div>
      </CustomerFrame>
    )
  }

  if (notFound) {
    return (
      <CustomerFrame lang={lang} onLangChange={setLang}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 'var(--sp4)' }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>❓</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--n900)' }}>
            {lang === 'ko' ? '명세서를 찾을 수 없습니다.' : 'Statement not found.'}
          </h1>
        </div>
      </CustomerFrame>
    )
  }

  if (!receipt) {
    return (
      <CustomerFrame lang={lang} onLangChange={setLang}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--n400)' }}>
          {lang === 'ko' ? '불러오는 중...' : 'Loading...'}
        </div>
      </CustomerFrame>
    )
  }

  const row = (label: string, value: string) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: 'var(--sp4) 0', borderBottom: '1px solid var(--n100)',
    }}>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--n500)' }}>{label}</span>
      <span style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--n900)' }}>{value}</span>
    </div>
  )

  return (
    <CustomerFrame lang={lang} onLangChange={setLang}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp6)' }}>
          <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 'var(--sp2)' }}>🎫</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--n900)' }}>
            {lang === 'ko' ? '응모 명세서' : 'Entry Statement'}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--n500)', marginTop: 'var(--sp2)' }}>
            {lang === 'ko' ? '이 화면을 직원에게 보여주세요.' : 'Show this screen to the staff.'}
          </p>
        </div>

        <div style={{
          background: 'var(--n0)', borderRadius: 'var(--r-md)',
          border: '1.5px solid var(--n200)', padding: 'var(--sp4) var(--sp6)',
        }}>
          {row(lang === 'ko' ? '매장' : 'Store', receipt.store_name)}
          {row(lang === 'ko' ? '이름' : 'Name', receipt.name)}
          {row(lang === 'ko' ? '전화번호' : 'Phone', receipt.phone)}
          {row(lang === 'ko' ? '생년월일' : 'Date of Birth', receipt.birthdate)}
          {row(
            lang === 'ko' ? '동반 자녀' : 'Children',
            receipt.children_count > 0
              ? (lang === 'ko' ? `${receipt.children_count}명` : `${receipt.children_count}`)
              : (lang === 'ko' ? '없음' : 'None'),
          )}
        </div>

        <p style={{ fontSize: '0.8125rem', color: 'var(--n400)', lineHeight: 1.7, marginTop: 'var(--sp6)', textAlign: 'center' }}>
          {lang === 'ko'
            ? <>직원이 신분 확인 후 응모가 완료됩니다.<br />당첨 시 등록하신 번호로 SMS 안내를 드립니다.</>
            : <>Your entry is confirmed after staff verification.<br />Winners are notified by SMS to the registered number.</>}
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
          {cancelling
            ? (lang === 'ko' ? '취소 중...' : 'Cancelling...')
            : (lang === 'ko' ? '응모 취소 (정보를 잘못 입력한 경우)' : 'Cancel entry (if info is wrong)')}
        </button>
      </div>
    </CustomerFrame>
  )
}
