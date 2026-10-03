'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  lotteryApi, DEFAULT_WINNER_SMS,
  type Store, type AdminApplicants, type ApplicantAdmin, type ImportResult, type SendSmsResult,
} from '@/lib/api'

// 수령 날짜별 색상 (시인성)
const PICKUP_COLORS = [
  { bg: '#dbeafe', fg: '#1d4ed8' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#fef9c3', fg: '#a16207' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#ede9fe', fg: '#6d28d9' },
  { bg: '#ffedd5', fg: '#c2410c' },
  { bg: '#cffafe', fg: '#0e7490' },
  { bg: '#e2e8f0', fg: '#334155' },
]
function pickupDateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
function pickupColor(iso: string) {
  const key = pickupDateKey(iso)
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return PICKUP_COLORS[h % PICKUP_COLORS.length]
}
function fmtPickup(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function LotteryAdminPage() {
  const [stores, setStores]     = useState<Store[]>([])
  const [code, setCode]         = useState('')
  const [data, setData]         = useState<AdminApplicants | null>(null)
  const [search, setSearch]     = useState('')
  const [qrModal, setQrModal]   = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [smsText, setSmsText]   = useState(DEFAULT_WINNER_SMS)
  const [sending, setSending]   = useState(false)
  const [sendResult, setSendResult] = useState<SendSmsResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const isOpen  = data?.is_open ?? false
  const qrUrl   = isOpen && data?.registration_token
    ? `${baseUrl}/lottery?store=${code}&token=${data.registration_token}`
    : ''

  const q = search.trim().toLowerCase()
  const applicants = (data?.applicants ?? []).filter(a =>
    q === '' || a.name.toLowerCase().includes(q) || a.phone.includes(q) || String(a.entry_no).includes(q)
  )
  const winners       = (data?.applicants ?? []).filter(a => a.is_winner)
  const winnerCount   = winners.length
  const unsentWinners = winners.filter(a => !a.notified_at)
  const unsentCount   = unsentWinners.length
  // 같은 번호는 1통으로 묶이므로, 실제 발송 건수 = 중복 제거한 번호 수
  const unsentPhones  = new Set(unsentWinners.map(a => a.phone)).size

  useEffect(() => {
    lotteryApi.getStores().then(s => {
      setStores(s)
      if (s.length > 0) setCode(prev => prev || s[0].code)
    }).catch(() => {})
  }, [])

  const refresh = useCallback(async () => {
    if (!code) return
    try { setData(await lotteryApi.getApplicants(code)) } catch {}
  }, [code])

  useEffect(() => {
    if (!code) return
    // 店舗を切り替えたら前の店舗の取込/送信結果・データをクリア（混同防止）
    setImportResult(null)
    setSendResult(null)
    setData(null)
    setSearch('')
    refresh()
    const timer = setInterval(refresh, 5000)
    return () => clearInterval(timer)
  }, [code, refresh])

  async function handleOpen() {
    if (!confirm('추첨 접수를 시작합니다.\n이 매장의 기존 응모 데이터가 모두 삭제됩니다.\n계속하시겠습니까?')) return
    await lotteryApi.open(code)
    refresh()
  }

  async function handleClose() {
    if (!confirm('추첨 접수를 종료합니다.\n종료 후에는 새로운 응모를 받을 수 없습니다.\n계속하시겠습니까?')) return
    await lotteryApi.close(code)
    refresh()
  }

  async function handleReset() {
    if (!confirm('이 매장의 모든 응모 데이터를 삭제합니다.\n계속하시겠습니까?')) return
    await lotteryApi.reset(code)
    refresh()
  }

  function handleExport() {
    window.open(lotteryApi.exportUrl(code), '_blank')
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    setSendResult(null)
    try {
      const result = await lotteryApi.importWinners(code, file)
      setImportResult(result)
      await refresh()
    } catch {
      alert('파일을 읽을 수 없습니다. 내보낸 엑셀 형식인지 확인해주세요.')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSendSms() {
    if (!smsText.trim()) { alert('보낼 문구를 입력해주세요.'); return }
    if (unsentPhones === 0) { alert('발송할 당첨자(미발송)가 없습니다.'); return }
    if (!confirm(`당첨자 ${unsentCount}명에게 SMS를 발송합니다.\n(같은 번호는 대표 1통으로 묶여 총 ${unsentPhones}건 발송)\n계속하시겠습니까?`)) return
    setSending(true)
    setSendResult(null)
    try {
      const result = await lotteryApi.sendSms(code, smsText)
      setSendResult(result)
      await refresh()
    } catch {
      alert('발송 중 오류가 발생했습니다.')
    } finally {
      setSending(false)
    }
  }

  async function handlePickup(a: ApplicantAdmin, checked: boolean) {
    // 낙관적 갱신 → 서버 반영 → 새로고침
    setData(prev => prev ? {
      ...prev,
      applicants: prev.applicants.map(x =>
        x.entry_no === a.entry_no
          ? { ...x, picked_up_at: checked ? new Date().toISOString() : null }
          : x),
    } : prev)
    try { await lotteryApi.setPickup(code, a.entry_no, checked) } catch {}
    refresh()
  }

  // 수령 날짜별 집계 (日付別の管理サマリ)
  const pickupGroups: { key: string; count: number; iso: string }[] = []
  const seenDate: Record<string, number> = {}
  ;(data?.applicants ?? []).forEach(a => {
    if (!a.picked_up_at) return
    const k = pickupDateKey(a.picked_up_at)
    const idx = seenDate[k]
    if (idx === undefined) { seenDate[k] = pickupGroups.length; pickupGroups.push({ key: k, count: 1, iso: a.picked_up_at }) }
    else pickupGroups[idx].count++
  })
  pickupGroups.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime())

  // 미리보기: {이름}/{매장} 치환 (예시 이름 = 첫 당첨자 또는 '홍길동')
  const previewName = winners[0]?.name ?? '홍길동'
  const smsPreview = smsText
    .replace(/\{이름\}/g, previewName)
    .replace(/\{매장\}/g, data?.store_name ?? '')

  return (
    <>
    <div className="adminWrap">
      <header className="adminHeader">
        <div className="adminHeaderTitle">추첨 관리</div>
        <div className="adminHeaderSub">포켓몬카드샵</div>
      </header>

      <div className="adminBody">

        {/* 店舗セレクタ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp3)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--n500)' }}>매장</span>
          <select
            value={code}
            onChange={e => setCode(e.target.value)}
            style={{
              flex: 1, minWidth: 160, padding: '10px var(--sp4)',
              border: '1.5px solid var(--n200)', borderRadius: 'var(--r-sm)',
              fontFamily: 'inherit', fontSize: '0.9375rem', color: 'var(--n900)',
              background: 'var(--n0)', outline: 'none',
            }}
          >
            {stores.length === 0 && <option value="">매장을 등록해주세요</option>}
            {stores.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        {/* 受付開閉 + QR */}
        <div style={{ background: 'var(--n0)', borderRadius: 'var(--r-md)', padding: 'var(--sp6)', display: 'flex', gap: 'var(--sp8)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--n500)', marginBottom: 'var(--sp3)' }}>접수 상태</p>
            <div style={{ marginBottom: 'var(--sp4)' }}>
              <span style={{
                fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 'var(--r-full)',
                background: isOpen ? 'var(--y100)' : 'var(--n100)',
                color: isOpen ? 'var(--y500)' : 'var(--n500)',
              }}>
                {isOpen ? '접수 중' : '접수 종료'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp2)' }}>
              <button onClick={handleOpen} disabled={isOpen || !code} style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: 'var(--r-sm)',
                fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                background: isOpen ? 'var(--n100)' : 'var(--y300)',
                color: isOpen ? 'var(--n400)' : 'var(--n900)',
              }}>접수 시작</button>
              <button onClick={handleClose} disabled={!isOpen} style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: 'var(--r-sm)',
                fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                background: !isOpen ? 'var(--n100)' : 'var(--n800)',
                color: !isOpen ? 'var(--n400)' : 'var(--n0)',
              }}>접수 종료</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp2)' }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--n500)' }}>QR 코드</p>
            {qrUrl ? (
              <>
                <div onClick={() => setQrModal(true)} style={{ background: 'white', padding: 12, borderRadius: 'var(--r-sm)', cursor: 'pointer' }}>
                  <QRCodeSVG value={qrUrl} size={120} />
                </div>
                <p style={{ fontSize: 10, color: 'var(--n400)', textAlign: 'center', maxWidth: 140 }}>탭하면 크게 볼 수 있습니다</p>
              </>
            ) : (
              <div style={{
                width: 144, height: 144, background: 'var(--n100)', borderRadius: 'var(--r-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--n400)', fontSize: '0.8125rem', fontWeight: 600,
              }}>접수 시작 후 표시</div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="adminStats">
          <div className="statCard">
            <div className="statLabel">응모 인원</div>
            <div className="statVal">{data?.count ?? 0}<span> 명</span></div>
          </div>
          <div className="statCard">
            <div className="statLabel">당첨</div>
            <div className="statVal">{winnerCount}<span> 명</span></div>
          </div>
        </div>

        {/* ① Excel 出力/取込（当選マーク） */}
        <div style={{ background: 'var(--n0)', borderRadius: 'var(--r-md)', padding: 'var(--sp6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp4)' }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--n500)' }}>① 추첨 (엑셀)</p>
          <div style={{ display: 'flex', gap: 'var(--sp2)', flexWrap: 'wrap' }}>
            <button onClick={handleExport} disabled={!code} style={{
              flex: 1, minWidth: 140, padding: '12px', border: 'none', borderRadius: 'var(--r-sm)',
              fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
              background: 'var(--b400)', color: 'var(--n0)',
            }}>엑셀 내보내기</button>
            <button onClick={() => fileRef.current?.click()} disabled={!code || importing} style={{
              flex: 1, minWidth: 140, padding: '12px', border: 'none', borderRadius: 'var(--r-sm)',
              fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
              background: 'var(--y300)', color: 'var(--n900)',
            }}>{importing ? '처리 중...' : '당첨 엑셀 가져오기'}</button>
            <input ref={fileRef} type="file" accept=".xlsx" onChange={handleImport} style={{ display: 'none' }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--n400)', lineHeight: 1.6 }}>
            내보낸 엑셀의 <strong>당첨여부</strong> 칸에 당첨자에게 <strong>O</strong> 를 입력한 뒤 다시 가져오면 당첨자로 <strong>표시</strong>됩니다. (SMS는 아래 ②에서 발송)
          </p>
          {importResult && (
            <div style={{ background: 'var(--b50)', borderRadius: 'var(--r-sm)', padding: 'var(--sp4)', fontSize: '0.875rem', color: 'var(--n700)', lineHeight: 1.8 }}>
              당첨 표시: <strong>{importResult.marked}</strong>명 · 전체 당첨: <strong>{importResult.total_winners}</strong>명 · 미발송: <strong>{importResult.unsent}</strong>명
              {importResult.not_found.length > 0 && <><br />매칭 실패 고유번호: {importResult.not_found.join(', ')}</>}
            </div>
          )}
        </div>

        {/* ② 当選SMS 文面入力 + 送信 */}
        <div style={{ background: 'var(--n0)', borderRadius: 'var(--r-md)', padding: 'var(--sp6)', display: 'flex', flexDirection: 'column', gap: 'var(--sp3)' }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--n500)' }}>② 당첨자 SMS</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--n400)', lineHeight: 1.6 }}>
            <strong>{'{이름}'}</strong> 은 당첨자 성명으로, <strong>{'{매장}'}</strong> 은 매장명으로 자동 치환됩니다.
          </p>
          <textarea
            value={smsText}
            onChange={e => setSmsText(e.target.value)}
            rows={12}
            style={{
              width: '100%', boxSizing: 'border-box', padding: 'var(--sp4)',
              border: '1.5px solid var(--n200)', borderRadius: 'var(--r-sm)',
              fontFamily: 'inherit', fontSize: '0.875rem', color: 'var(--n900)',
              lineHeight: 1.6, outline: 'none', resize: 'vertical', background: 'var(--n0)',
            }}
          />
          {/* 미리보기 */}
          <div style={{ fontSize: '0.75rem', color: 'var(--n400)' }}>미리보기 (예시 이름: {previewName})</div>
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
            background: 'var(--n50)', borderRadius: 'var(--r-sm)', padding: 'var(--sp4)',
            fontFamily: 'inherit', fontSize: '0.8125rem', color: 'var(--n700)', lineHeight: 1.6,
          }}>{smsPreview}</pre>
          <button onClick={handleSendSms} disabled={!code || sending || unsentPhones === 0} style={{
            padding: '14px', border: 'none', borderRadius: 'var(--r-sm)',
            fontFamily: 'inherit', fontSize: '0.9375rem', fontWeight: 800, cursor: 'pointer',
            background: unsentPhones === 0 ? 'var(--n100)' : 'var(--y400)',
            color: unsentPhones === 0 ? 'var(--n400)' : 'var(--n900)',
          }}>
            {sending
              ? '발송 중...'
              : unsentPhones === 0
                ? '발송할 당첨자 없음'
                : `당첨자에게 SMS 발송 (${unsentPhones}건 · 당첨 ${unsentCount}명)`}
          </button>
          <p style={{ fontSize: '0.75rem', color: 'var(--n400)', lineHeight: 1.6 }}>
            같은 번호(부모+자녀 등)는 대표 1통으로 묶여 발송됩니다.
          </p>
          {sendResult && (
            <div style={{ background: 'var(--b50)', borderRadius: 'var(--r-sm)', padding: 'var(--sp4)', fontSize: '0.875rem', color: 'var(--n700)', lineHeight: 1.8 }}>
              발송 <strong>{sendResult.target}</strong>건(성공 <strong>{sendResult.sent}</strong> · 실패 {sendResult.failed}) · 당첨자 {sendResult.recipients}명
            </div>
          )}
        </div>

        {/* 検索 */}
        <input type="search" placeholder="이름 · 전화번호 · 고유번호로 검색"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px var(--sp4)',
            border: '1.5px solid var(--n200)', borderRadius: 'var(--r-sm)',
            fontFamily: 'inherit', fontSize: '0.9375rem', color: 'var(--n900)',
            outline: 'none', background: 'var(--n0)',
          }} />

        {/* 수령 날짜별 집계 (日付別の管理サマリ) */}
        {pickupGroups.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp2)', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--n500)' }}>수령 현황</span>
            {pickupGroups.map(g => {
              const c = pickupColor(g.iso)
              return (
                <span key={g.key} style={{
                  fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 'var(--r-full)',
                  background: c.bg, color: c.fg,
                }}>
                  {fmtPickup(g.iso)} · {g.count}명
                </span>
              )
            })}
          </div>
        )}

        {/* 応募者リスト */}
        <div className="listSection">
          <div className="listHeader">
            <span className="listHeaderTitle">응모자</span>
            <span className="listBadge listBadgeW">
              {q ? `${applicants.length} / ${data?.count ?? 0}명` : `${data?.count ?? 0}명`}
            </span>
          </div>
          {applicants.length === 0 ? (
            <div style={{ padding: 'var(--sp8)', textAlign: 'center', color: 'var(--n400)', fontSize: '0.875rem' }}>
              응모자가 없습니다.
            </div>
          ) : applicants.map(a => {
            const c = a.picked_up_at ? pickupColor(a.picked_up_at) : null
            return (
            <div key={a.entry_no} style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              columnGap: 'var(--sp3)', rowGap: 6, padding: '12px var(--sp6)',
              borderBottom: '1px solid var(--n100)',
            }}>
              {/* 1行目: 番号・名前・当落・受取 */}
              <span className="rowNum" style={{ minWidth: 34 }}>#{a.entry_no}</span>
              <span className="rowName" style={{ flex: '1 1 110px' }}>
                {a.name}
                {a.is_child && <span style={{ fontSize: 11, color: 'var(--b400)', marginLeft: 4 }}>👶</span>}
                {a.children_count > 0 && <span style={{ fontSize: 11, color: 'var(--b400)', marginLeft: 4 }}>👨‍👧 {a.children_count}</span>}
              </span>
              {a.is_winner
                ? <span className="rowStatus rowStatusD">{a.notified_at ? '발송완료' : '당첨'}</span>
                : winnerCount > 0
                  ? <span className="rowStatus" style={{ background: 'var(--n100)', color: 'var(--n400)' }}>낙첨</span>
                  : <span className="rowStatus rowStatusW">응모</span>}
              {/* 수령 체크 + 날짜(색상) */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginLeft: 'auto' }}>
                <input
                  type="checkbox"
                  checked={!!a.picked_up_at}
                  onChange={e => handlePickup(a, e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
                />
                {a.picked_up_at && c
                  ? <span style={{
                      fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--r-full)',
                      background: c.bg, color: c.fg, whiteSpace: 'nowrap',
                    }}>수령 {fmtPickup(a.picked_up_at)}</span>
                  : <span style={{ fontSize: 11, color: 'var(--n400)', whiteSpace: 'nowrap' }}>수령</span>}
              </label>
              {/* 2行目: 電話番号・生年月日 (全幅) */}
              <div style={{
                flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 'var(--sp4)',
                paddingLeft: 34, fontSize: 12, color: 'var(--n500)', fontVariantNumeric: 'tabular-nums',
              }}>
                <span>📞 {a.phone}</span>
                <span>🎂 {a.birthdate}</span>
              </div>
            </div>
            )
          })}
        </div>

        <button onClick={handleReset} disabled={!code} style={{
          background: 'none', border: 'none', fontSize: '0.8125rem', color: 'var(--n400)',
          cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', marginTop: 'var(--sp2)',
        }}>이 매장 응모 데이터 초기화</button>

      </div>
    </div>

    {qrModal && qrUrl && (
      <div onClick={() => setQrModal(false)} style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <div style={{ background: 'white', padding: 24, borderRadius: 16 }}>
          <QRCodeSVG value={qrUrl} size={280} />
        </div>
        <p style={{ color: 'white', fontSize: '0.9375rem', opacity: 0.7 }}>탭하면 닫힙니다</p>
      </div>
    )}
    </>
  )
}
