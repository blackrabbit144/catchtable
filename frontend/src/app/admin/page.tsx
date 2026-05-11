'use client'

import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api, type Customer, type QueueSettings } from '@/lib/api'

export default function AdminPage() {
  const [customers, setCustomers]   = useState<Customer[]>([])
  const [settings, setSettings]     = useState<QueueSettings | null>(null)
  const [maxInput, setMaxInput]     = useState('100')
  const [loading, setLoading]       = useState(false)
  const [search, setSearch]         = useState('')

  const q = search.trim().toLowerCase()
  const match = (c: Customer) =>
    c.name.toLowerCase().includes(q) || c.phone.includes(q)

  const waiting = customers.filter(c => c.status === 'waiting' && (q === '' || match(c)))
  const called  = customers.filter(c => c.status === 'called'  && (q === '' || match(c)))
  const waitingTotal = customers.filter(c => c.status === 'waiting').length
  const calledTotal  = customers.filter(c => c.status === 'called').length
  const callBatch   = Math.min(5, waitingTotal)
  const maxCount    = settings?.max_count ?? 100
  const progressPct = Math.round((waitingTotal / maxCount) * 100)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const qrUrl   = settings?.registration_token
    ? `${baseUrl}/?token=${settings.registration_token}`
    : ''

  const refresh = useCallback(async () => {
    const [c, s] = await Promise.all([api.getAdminCustomers(), api.getSettings()])
    setCustomers(c)
    setSettings(s)
    setMaxInput(String(s.max_count))
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 5000)
    return () => clearInterval(timer)
  }, [refresh])

  async function handleOpen() {
    const s = await api.openRegistration()
    setSettings(s)
  }

  async function handleClose() {
    const s = await api.closeRegistration()
    setSettings(s)
  }

  async function handleCall() {
    if (waiting.length === 0 || loading) return
    setLoading(true)
    try { await api.callNext(); await refresh() }
    finally { setLoading(false) }
  }

  async function handleApplyMax() {
    const val = parseInt(maxInput)
    if (isNaN(val) || val < 1) return
    const s = await api.updateSettings(val)
    setSettings(s)
  }

  const isOpen = settings?.is_open ?? false

  return (
    <div className="adminWrap">
      <header className="adminHeader">
        <div className="adminHeaderTitle">관리자 대시보드</div>
        <div className="adminHeaderSub">포켓몬카드샵</div>
      </header>

      <div className="adminBody">

        {/* 受付開閉 + QRコード */}
        <div style={{ background: 'var(--n0)', borderRadius: 'var(--r-md)', padding: 'var(--sp6)', display: 'flex', gap: 'var(--sp8)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--n500)', marginBottom: 'var(--sp3)' }}>접수 상태</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp3)', marginBottom: 'var(--sp4)' }}>
              <span style={{
                fontSize: 13, fontWeight: 700, padding: '4px 12px',
                borderRadius: 'var(--r-full)',
                background: isOpen ? 'var(--y100)' : 'var(--n100)',
                color: isOpen ? 'var(--y500)' : 'var(--n500)',
              }}>
                {isOpen ? '접수 중' : '접수 종료'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp2)' }}>
              <button
                onClick={handleOpen}
                disabled={isOpen}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: 'var(--r-sm)',
                  fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                  background: isOpen ? 'var(--n100)' : 'var(--y300)',
                  color: isOpen ? 'var(--n400)' : 'var(--n900)',
                  transition: 'all 0.15s',
                }}
              >
                접수 시작
              </button>
              <button
                onClick={handleClose}
                disabled={!isOpen}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: 'var(--r-sm)',
                  fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                  background: !isOpen ? 'var(--n100)' : 'var(--n800)',
                  color: !isOpen ? 'var(--n400)' : 'var(--n0)',
                  transition: 'all 0.15s',
                }}
              >
                접수 종료
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp2)' }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--n500)' }}>QR 코드</p>
            {isOpen && qrUrl ? (
              <>
                <div style={{ background: 'white', padding: 12, borderRadius: 'var(--r-sm)' }}>
                  <QRCodeSVG value={qrUrl} size={120} />
                </div>
                <p style={{ fontSize: 10, color: 'var(--n400)', textAlign: 'center', maxWidth: 140, wordBreak: 'break-all' }}>
                  접수 시작 시마다 갱신됩니다
                </p>
              </>
            ) : (
              <div style={{
                width: 144, height: 144, background: 'var(--n100)',
                borderRadius: 'var(--r-sm)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--n400)', fontSize: '0.8125rem', fontWeight: 600,
              }}>
                접수 시작 후 표시
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="adminStats">
          <div className="statCard">
            <div className="statLabel">현재 대기</div>
            <div className="statVal">{waitingTotal}<span> 명</span></div>
            <div className="statMax">최대 {maxCount}명</div>
            <div className="progressBar">
              <div className="progressFill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="statCard">
            <div className="statLabel">호출 완료</div>
            <div className="statVal">{calledTotal}<span> 명</span></div>
          </div>
        </div>

        {/* Settings */}
        <div className="adminSettings">
          <span className="settingsLabel">상한 인원 설정</span>
          <input className="settingsInput" type="number" value={maxInput}
            onChange={e => setMaxInput(e.target.value)} min={1} />
          <span className="settingsUnit">명</span>
          <button className="btnChange" onClick={handleApplyMax}>변경</button>
        </div>

        {/* Call button */}
        <button className="btnCall" onClick={handleCall} disabled={waitingTotal === 0 || loading}>
          {loading ? '호출 중...' : waitingTotal === 0 ? '대기 인원 없음' : `${callBatch}명 호출하기`}
        </button>

        {/* Search */}
        <input
          type="search"
          placeholder="이름 또는 전화번호로 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px var(--sp4)', border: '1.5px solid var(--n200)',
            borderRadius: 'var(--r-sm)', fontFamily: 'inherit',
            fontSize: '0.9375rem', color: 'var(--n900)',
            outline: 'none', background: 'var(--n0)',
          }}
        />

        {/* Waiting list */}
        <div className="listSection">
          <div className="listHeader">
            <span className="listHeaderTitle">대기 중</span>
            <span className="listBadge listBadgeW">
              {q ? `${waiting.length} / ${waitingTotal}명` : `${waitingTotal}명`}
            </span>
          </div>
          {waiting.length === 0 ? (
            <div style={{ padding: 'var(--sp8)', textAlign: 'center', color: 'var(--n400)', fontSize: '0.875rem' }}>
              대기 중인 손님이 없습니다.
            </div>
          ) : waiting.map(c => (
            <div key={c.id} className="listRow">
              <span className="rowNum">#{c.number}</span>
              <span className="rowName">{c.name}</span>
              <span className="rowPhone">{c.phone}</span>
              <span className="rowStatus rowStatusW">대기중</span>
            </div>
          ))}
        </div>

        {/* Called list */}
        <div className="listSection">
          <div className="listHeader">
            <span className="listHeaderTitle">호출 완료</span>
            <span className="listBadge listBadgeD">
              {q ? `${called.length} / ${calledTotal}명` : `${calledTotal}명`}
            </span>
          </div>
          {called.length === 0 ? (
            <div style={{ padding: 'var(--sp8)', textAlign: 'center', color: 'var(--n400)', fontSize: '0.875rem' }}>
              호출된 손님이 없습니다.
            </div>
          ) : [...called].reverse().map(c => (
            <div key={c.id} className="listRow listRowDone">
              <span className="rowNum rowNumDone">#{c.number}</span>
              <span className="rowName">{c.name}</span>
              <span className="rowPhone">{c.phone}</span>
              <span className="rowStatus rowStatusD">완료</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
