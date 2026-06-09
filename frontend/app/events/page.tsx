'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { apiGet, apiPatch, formatDate } from '@/lib/client-api'
import { AdminGate } from '../components/AdminGate'

interface EventOut {
  id: number; entity: string; event_type: string; title: string; summary: string
  url: string; source: string; event_date: string; date_confidence: string
  is_baseline_event: boolean; is_market_latest: boolean; evidence_reason: string | null
  importance_score: number; novelty_score: number; status: string; created_at: string
}

const PAGE_SIZE = 20
const STATUS_OPTIONS = [
  { value: 'new', label: '新' },
  { value: 'important', label: '重要' },
  { value: 'read', label: '已读' },
  { value: 'ignored', label: '忽略' },
]

function eventMatchesSearch(event: EventOut, keyword: string) {
  const q = keyword.trim().toLowerCase()
  if (!q) return true
  return [event.title, event.summary, event.entity, event.source].some((value) => value.toLowerCase().includes(q))
}

function indicatorColor(score: number) {
  if (score >= 0.8) return 'var(--danger)'
  if (score >= 0.6) return 'var(--orange)'
  return 'var(--accent)'
}

function visiblePageNumbers(page: number, totalPages: number) {
  const maxButtons = 7
  if (totalPages <= maxButtons) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const start = Math.max(1, Math.min(page - 3, totalPages - maxButtons + 1))
  return Array.from({ length: maxButtons }, (_, i) => start + i)
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [page, setPage] = useState(1)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<EventOut[]>('/api/events?limit=300')
      setEvents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '事件加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const entities = useMemo(() => [...new Set(events.map(e => e.entity))].sort(), [events])

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (statusFilter && event.status !== statusFilter) return false
      if (entityFilter && event.entity !== entityFilter) return false
      return eventMatchesSearch(event, search)
    })
  }, [events, entityFilter, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageNumbers = visiblePageNumbers(currentPage, totalPages)

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage)
  }, [currentPage, page])

  const updateStatus = async (id: number, newStatus: string) => {
    const previous = events
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e))
    try {
      await apiPatch(`/api/events/${id}`, { status: newStatus })
    } catch {
      setEvents(previous)
    }
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
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="搜索标题、摘要、实体或来源..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="form-select" style={{ width: 'auto', minWidth: 130 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
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
      ) : error ? (
        <div className="empty-state"><h3>加载失败</h3><p>{error}</p></div>
      ) : paged.length === 0 ? (
        <div className="empty-state"><h3>暂无事件</h3><p>等待数据采集完成后将显示事件。</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paged.map((ev) => (
            <div key={ev.id} className="event-card animate-in">
              <div className="event-card__indicator" style={{ background: indicatorColor(ev.importance_score) }} />
              <div className="event-card__body">
                <div className="event-card__title">
                  <a href={ev.url} target="_blank" rel="noopener noreferrer">{ev.title} <ExternalLink size={12} /></a>
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
                  <AdminGate message="修改事件状态需要管理员口令。">
                    <div style={{ display: 'flex', gap: 4 }}>
                      {STATUS_OPTIONS.map(status => (
                        <button key={status.value} className={`btn btn-sm ${ev.status === status.value ? 'btn-primary' : 'btn-secondary'}`} onClick={() => updateStatus(ev.id, status.value)}>{status.label}</button>
                      ))}
                    </div>
                  </AdminGate>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="pagination">
          <button disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={16} /></button>
          {pageNumbers[0] > 1 && <span className="text-muted">...</span>}
          {pageNumbers.map((p) => <button key={p} className={currentPage === p ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>)}
          {pageNumbers[pageNumbers.length - 1] < totalPages && <span className="text-muted">...</span>}
          <button disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  )
}
