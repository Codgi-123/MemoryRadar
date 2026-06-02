'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { publicBase, formatDate } from '@/lib/api'

interface EventOut {
  id: number; entity: string; event_type: string; title: string; summary: string
  url: string; source: string; event_date: string; date_confidence: string
  is_baseline_event: boolean; is_market_latest: boolean; evidence_reason: string | null
  importance_score: number; novelty_score: number; status: string; created_at: string
}

const PAGE_SIZE = 20

export default function EventsPage() {
  const [events, setEvents] = useState<EventOut[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [page, setPage] = useState(1)

  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (statusFilter) params.set('status', statusFilter)
      if (entityFilter) params.set('entity', entityFilter)
      const res = await fetch(`${publicBase}/api/events?${params}`)
      const data = await res.json()
      setEvents(data)
    } catch {} finally { setLoading(false) }
  }, [statusFilter, entityFilter])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const entities = useMemo(() => [...new Set(events.map(e => e.entity))].sort(), [events])

  const filtered = useMemo(() => {
    if (!search) return events
    const q = search.toLowerCase()
    return events.filter(e => e.title.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q))
  }, [events, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      const res = await fetch(`${publicBase}/api/events/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        setEvents(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e))
      }
    } catch {}
  }

  const indicatorColor = (score: number) => {
    if (score >= 8) return 'var(--danger)'
    if (score >= 5) return 'var(--orange)'
    return 'var(--accent)'
  }

  return (
    <div>
      <div className="page-header">
        <h1>事件流</h1>
        <p>追踪到的市场动态与开源项目事件</p>
      </div>

      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--subtle)' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="搜索标题或摘要..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="form-select" style={{ width: 'auto', minWidth: 130 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">全部状态</option>
          <option value="new">new</option>
          <option value="reviewed">reviewed</option>
          <option value="important">important</option>
          <option value="dismissed">dismissed</option>
        </select>
        <select className="form-select" style={{ width: 'auto', minWidth: 130 }} value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1) }}>
          <option value="">全部实体</option>
          {entities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
        </select>
        <span className="text-muted text-sm">{filtered.length} 条结果</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : paged.length === 0 ? (
        <div className="empty-state"><h3>暂无事件</h3><p>等待数据采集完成后将显示事件。</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paged.map((ev) => (
            <div key={ev.id} className="event-card animate-in">
              <div className="event-card__indicator" style={{ background: indicatorColor(ev.importance_score) }} />
              <div className="event-card__body">
                <div className="event-card__title">
                  <a href={ev.url} target="_blank" rel="noopener">{ev.title} <ExternalLink size={12} /></a>
                </div>
                <div className="event-card__meta">
                  <span className="badge badge--blue">{ev.entity}</span>
                  <span className="badge badge--gray">{ev.event_type}</span>
                  <span className="badge badge--gray">{ev.source}</span>
                  {ev.is_market_latest && <span className="badge badge--green">最新</span>}
                  {ev.is_baseline_event && <span className="badge badge--orange">基线</span>}
                </div>
                <div className="event-card__summary">{ev.summary}</div>
                <div className="event-card__actions">
                  <span className="text-muted text-sm">{formatDate(ev.event_date)} · {ev.date_confidence}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['important', 'reviewed', 'dismissed'].map(s => (
                      <button key={s} className={`btn btn-sm ${ev.status === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateStatus(ev.id, s)}>{s === 'important' ? '重要' : s === 'reviewed' ? '已读' : '忽略'}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = i + 1
            return <button key={p} className={page === p ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
          })}
          {totalPages > 7 && <span className="text-muted">...</span>}
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  )
}
