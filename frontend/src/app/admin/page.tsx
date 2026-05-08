'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, type Customer } from '@/lib/api'

export default function AdminPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [maxCount, setMaxCount]   = useState(100)
  const [maxInput, setMaxInput]   = useState('100')
  const [loading, setLoading]     = useState(false)

  const waiting = customers.filter(c => c.status === 'waiting')
  const called  = customers.filter(c => c.status === 'called')
  const callBatch  = Math.min(5, waiting.length)
  const progressPct = Math.round((waiting.length / maxCount) * 100)

  const refresh = useCallback(async () => {
    const [customers, settings] = await Promise.all([
      api.getAdminCustomers(),
      api.getSettings(),
    ])
    setCustomers(customers)
    setMaxCount(settings.max_count)
    setMaxInput(String(settings.max_count))
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 5000)
    return () => clearInterval(timer)
  }, [refresh])

  async function handleCall() {
    if (waiting.length === 0 || loading) return
    setLoading(true)
    try {
      await api.callNext()
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleApplyMax() {
    const val = parseInt(maxInput)
    if (isNaN(val) || val < 1) return
    await api.updateSettings(val)
    setMaxCount(val)
  }

  return (
    <div className="adminWrap">
      <header className="adminHeader">
        <div className="adminHeaderTitle">관리자 대시보드</div>
        <div className="adminHeaderSub">포켓몬카드샵</div>
      </header>

      <div className="adminBody">
        {/* Stats */}
        <div className="adminStats">
          <div className="statCard">
            <div className="statLabel">현재 대기</div>
            <div className="statVal">{waiting.length}<span> 명</span></div>
            <div className="statMax">최대 {maxCount}명</div>
            <div className="progressBar">
              <div className="progressFill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="statCard">
            <div className="statLabel">호출 완료</div>
            <div className="statVal">{called.length}<span> 명</span></div>
          </div>
        </div>

        {/* Settings */}
        <div className="adminSettings">
          <span className="settingsLabel">상한 인원 설정</span>
          <input
            className="settingsInput"
            type="number"
            value={maxInput}
            onChange={e => setMaxInput(e.target.value)}
            min={1}
          />
          <span className="settingsUnit">명</span>
          <button className="btnChange" onClick={handleApplyMax}>변경</button>
        </div>

        {/* Call button */}
        <button
          className="btnCall"
          onClick={handleCall}
          disabled={waiting.length === 0 || loading}
        >
          {loading
            ? '호출 중...'
            : waiting.length === 0
              ? '대기 인원 없음'
              : `${callBatch}명 호출하기`}
        </button>

        {/* Waiting list */}
        <div className="listSection">
          <div className="listHeader">
            <span className="listHeaderTitle">대기 중</span>
            <span className="listBadge listBadgeW">{waiting.length}명</span>
          </div>
          {waiting.length === 0 ? (
            <div style={{ padding: 'var(--sp8)', textAlign: 'center', color: 'var(--n400)', fontSize: '0.875rem' }}>
              대기 중인 손님이 없습니다.
            </div>
          ) : (
            waiting.map(c => (
              <div key={c.id} className="listRow">
                <span className="rowNum">#{c.number}</span>
                <span className="rowName">{c.name}</span>
                <span className="rowPhone">{c.phone}</span>
                <span className="rowStatus rowStatusW">대기중</span>
              </div>
            ))
          )}
        </div>

        {/* Called list */}
        <div className="listSection">
          <div className="listHeader">
            <span className="listHeaderTitle">호출 완료</span>
            <span className="listBadge listBadgeD">{called.length}명</span>
          </div>
          {called.length === 0 ? (
            <div style={{ padding: 'var(--sp8)', textAlign: 'center', color: 'var(--n400)', fontSize: '0.875rem' }}>
              호출된 손님이 없습니다.
            </div>
          ) : (
            [...called].reverse().map(c => (
              <div key={c.id} className="listRow listRowDone">
                <span className="rowNum rowNumDone">#{c.number}</span>
                <span className="rowName">{c.name}</span>
                <span className="rowPhone">{c.phone}</span>
                <span className="rowStatus rowStatusD">완료</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
