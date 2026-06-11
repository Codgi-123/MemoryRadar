'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, ExternalLink, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { apiGet, apiPatch, formatDate } from '@/lib/client-api'
import { AdminGate } from '../components/AdminGate'
import { Badge, Button, EmptyState, Input, PageHeader, Select, Skeleton } from '../components/ui'

interface EventOut {
  id: number; entity: string; event_type: string; title: string; summary: string
  url: string; source: string; event_date: string; date_confidence: string
  is_baseline_event: boolean; is_market_latest: boolean; evidence_reason: string | null
  importance_score: number; novelty_score: number; status: string; created_at: string
}

type GroupMode = 'none' | 'date' | 'entity' | 'source' | 'type'

const PAGE_SIZE = 20
const GROUP_PAGE_SIZE = 8
const STATUS_OPTIONS = [
  { value: 'new', label: '新' },
  { value: 'important', label: '重要' },
  { value: 'read', label: '已读' },
  { value: 'ignored', label: '忽略' },
]
const GROUP_OPTIONS: { value: GroupMode; label: string }[] = [
  { value: 'none', label: '不分组' },
  { value: 'date', label: '按日期' },
  { value: 'entity', label: '按实体' },
  { value: 'source', label: '按来源' },
  { value: 'type', label: '按事件类型' },
]

interface EventGroup {
  id: string
  key: string
  label: string
  events: EventOut[]
  latestCount: number
  baselineCount: number
  importantCount: number
  maxImportance: number
  latestEventDate: string
}

function eventMatchesSearch(event: EventOut, keyword: string) {
  const q = keyword.trim().toLowerCase()
  if (!q) return true
  return [event.title, event.summary, event.entity, event.source].some((value) => value.toLowerCase().includes(q))
}

function indicatorClass(score: number) {
  if (score >= 0.8) return 'bg-danger'
  if (score >= 0.6) return 'bg-orange'
  return 'bg-accent'
}

function visiblePageNumbers(page: number, totalPages: number) {
  const maxButtons = 7
  if (totalPages <= maxButtons) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const start = Math.max(1, Math.min(page - 3, totalPages - maxButtons + 1))
  return Array.from({ length: maxButtons }, (_, i) => start + i)
}

function groupKey(event: EventOut, mode: GroupMode) {
  if (mode === 'date') return event.event_date
  if (mode === 'entity') return event.entity || '未知实体'
  if (mode === 'source') return event.source || '未知来源'
  if (mode === 'type') return event.event_type || '未知类型'
  return 'all'
}

function groupLabel(key: string, mode: GroupMode) {
  if (mode === 'date') return formatDate(key)
  return key
}

function sortForGroupMode(events: EventOut[], mode: GroupMode) {
  if (mode === 'none') return events
  return [...events].sort((a, b) => {
    const aKey = groupKey(a, mode)
    const bKey = groupKey(b, mode)
    if (aKey !== bKey) {
      if (mode === 'date') return bKey.localeCompare(aKey)
      return aKey.localeCompare(bKey, 'zh-CN')
    }
    if (a.event_date !== b.event_date) return b.event_date.localeCompare(a.event_date)
    if (a.importance_score !== b.importance_score) return b.importance_score - a.importance_score
    return b.created_at.localeCompare(a.created_at)
  })
}

function groupEvents(events: EventOut[], mode: Exclude<GroupMode, 'none'>) {
  const groups: EventGroup[] = []
  const byKey = new Map<string, EventGroup>()

  for (const event of events) {
    const key = groupKey(event, mode)
    let group = byKey.get(key)
    if (!group) {
      group = {
        id: `${mode}:${key}`,
        key,
        label: groupLabel(key, mode),
        events: [],
        latestCount: 0,
        baselineCount: 0,
        importantCount: 0,
        maxImportance: 0,
        latestEventDate: event.event_date,
      }
      byKey.set(key, group)
      groups.push(group)
    }
    group.events.push(event)
    if (event.is_market_latest) group.latestCount += 1
    if (event.is_baseline_event) group.baselineCount += 1
    if (event.importance_score >= 0.6) group.importantCount += 1
    if (event.importance_score > group.maxImportance) group.maxImportance = event.importance_score
    if (event.event_date > group.latestEventDate) group.latestEventDate = event.event_date
  }

  return groups
}

function pageItems<T>(items: T[], page: number, pageSize: number) {
  return items.slice((page - 1) * pageSize, page * pageSize)
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [groupBy, setGroupBy] = useState<GroupMode>('none')
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set())
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

  const displayEvents = useMemo(() => sortForGroupMode(filtered, groupBy), [filtered, groupBy])
  const allGroups = useMemo(() => {
    if (groupBy === 'none') return []
    return groupEvents(displayEvents, groupBy)
  }, [displayEvents, groupBy])
  const paginationTotal = groupBy === 'none' ? displayEvents.length : allGroups.length
  const activePageSize = groupBy === 'none' ? PAGE_SIZE : GROUP_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(paginationTotal / activePageSize))
  const currentPage = Math.min(page, totalPages)
  const paged = useMemo(() => pageItems(displayEvents, currentPage, PAGE_SIZE), [currentPage, displayEvents])
  const pagedGroups = useMemo(() => pageItems(allGroups, currentPage, GROUP_PAGE_SIZE), [allGroups, currentPage])
  const pageNumbers = visiblePageNumbers(currentPage, totalPages)
  const visibleCollapsedCount = pagedGroups.filter(group => collapsedGroupIds.has(group.id)).length
  const groupModeLabel = GROUP_OPTIONS.find(option => option.value === groupBy)?.label ?? ''

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage)
  }, [currentPage, page])

  useEffect(() => {
    if (groupBy === 'none') return
    const validIds = new Set(allGroups.map(group => group.id))
    setCollapsedGroupIds(prev => {
      const next = new Set([...prev].filter(id => validIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [allGroups, groupBy])

  const updateStatus = async (id: number, newStatus: string) => {
    const previous = events
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e))
    try {
      await apiPatch(`/api/events/${id}`, { status: newStatus })
    } catch {
      setEvents(previous)
    }
  }

  const toggleGroup = (groupId: string) => {
    setCollapsedGroupIds(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const collapseCurrentPageGroups = () => {
    setCollapsedGroupIds(prev => new Set([...prev, ...pagedGroups.map(group => group.id)]))
  }

  const expandCurrentPageGroups = () => {
    setCollapsedGroupIds(prev => {
      const next = new Set(prev)
      for (const group of pagedGroups) next.delete(group.id)
      return next
    })
  }

  const renderEventCard = (ev: EventOut) => (
    <div key={ev.id} className="relative flex animate-[fadeInUp_400ms_ease_both] overflow-hidden rounded border border-line bg-surface shadow-sm transition hover:border-accent-muted hover:shadow-md">
      <div className={clsx('w-1 shrink-0', indicatorClass(ev.importance_score))} />
      <div className="min-w-0 flex-1 p-4">
        <div className="mb-2 text-[0.98rem] font-semibold leading-snug tracking-normal text-text">
          <a className="inline-flex items-center gap-1 text-inherit no-underline transition hover:text-accent" href={ev.url} target="_blank" rel="noopener noreferrer">
            {ev.title}
            <ExternalLink size={12} />
          </a>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Badge tone="blue">{ev.entity}</Badge>
          <Badge>{ev.event_type}</Badge>
          <Badge>{ev.source}</Badge>
          {ev.is_market_latest && <Badge tone="green">最新</Badge>}
          {ev.is_baseline_event && <Badge tone="orange">基线</Badge>}
        </div>
        <div className="mb-3 text-[0.875rem] leading-relaxed text-muted">{ev.summary}</div>
        <div className="flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
          <span className="text-[0.8rem] text-muted">{formatDate(ev.event_date)} · {ev.date_confidence}</span>
          <AdminGate message="修改事件状态需要管理员口令。">
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map(status => (
                <Button key={status.value} size="sm" variant={ev.status === status.value ? 'primary' : 'secondary'} onClick={() => updateStatus(ev.id, status.value)}>{status.label}</Button>
              ))}
            </div>
          </AdminGate>
        </div>
      </div>
    </div>
  )

  const renderGroup = (group: EventGroup) => {
    const collapsed = collapsedGroupIds.has(group.id)
    const importance = Math.round(group.maxImportance * 100)

    return (
      <section key={group.id} className="overflow-hidden rounded border border-line bg-surface shadow-sm">
        <button
          type="button"
          className={clsx(
            'flex w-full items-start justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-bg',
            !collapsed && 'border-b border-line-soft'
          )}
          aria-expanded={!collapsed}
          onClick={() => toggleGroup(group.id)}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-line bg-surface text-muted">
              {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="m-0 min-w-0 text-[0.98rem] font-bold leading-tight tracking-normal text-text [overflow-wrap:anywhere]">{group.label}</h2>
                <Badge>{group.events.length} 条</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.78rem] text-muted">
                <span>最近 {formatDate(group.latestEventDate)}</span>
                <span>最高重要度 {importance}</span>
                <span>{collapsed ? '已收起' : '已展开'}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 max-md:hidden">
            {group.importantCount > 0 && <Badge tone="red">重要 {group.importantCount}</Badge>}
            {group.latestCount > 0 && <Badge tone="green">最新 {group.latestCount}</Badge>}
            {group.baselineCount > 0 && <Badge tone="orange">基线 {group.baselineCount}</Badge>}
          </div>
        </button>
        {!collapsed && (
          <div className="bg-bg p-3">
            <div className="flex flex-col gap-2.5">
              {group.events.map(renderEventCard)}
            </div>
          </div>
        )}
      </section>
    )
  }

  const renderPagination = () => {
    if (totalPages <= 1) return null

    return (
      <div className="mt-6 flex items-center justify-center gap-1.5">
        <button className="flex h-8 min-w-8 items-center justify-center rounded-sm border border-line bg-surface px-2 text-[0.8rem] text-muted transition hover:bg-line-soft disabled:pointer-events-none disabled:opacity-40" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={16} /></button>
        {pageNumbers[0] > 1 && <span className="px-1.5 text-muted">...</span>}
        {pageNumbers.map((p) => (
          <button
            key={p}
            className={clsx(
              'flex h-8 min-w-8 items-center justify-center rounded-sm border px-2 text-[0.8rem] transition',
              currentPage === p ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-muted hover:bg-line-soft'
            )}
            onClick={() => setPage(p)}
          >
            {p}
          </button>
        ))}
        {pageNumbers[pageNumbers.length - 1] < totalPages && <span className="px-1.5 text-muted">...</span>}
        <button className="flex h-8 min-w-8 items-center justify-center rounded-sm border border-line bg-surface px-2 text-[0.8rem] text-muted transition hover:bg-line-soft disabled:pointer-events-none disabled:opacity-40" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><ChevronRight size={16} /></button>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="事件流" description="追踪到的市场动态与开源项目事件" />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded border border-line bg-surface p-3">
        <div className="relative max-w-[300px] flex-1 max-md:max-w-none max-md:basis-full">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input className="pl-9" placeholder="搜索标题、摘要、实体或来源..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <Select className="w-auto min-w-[130px]" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </Select>
        <Select className="w-auto min-w-[130px]" value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1) }}>
          <option value="">全部实体</option>
          {entities.map(ent => <option key={ent} value={ent}>{ent}</option>)}
        </Select>
        <Select className="w-auto min-w-[140px]" value={groupBy} onChange={e => { setGroupBy(e.target.value as GroupMode); setPage(1) }}>
          {GROUP_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
        <span className="text-[0.8rem] text-muted">
          {groupBy === 'none' ? `${filtered.length} 条结果` : `${filtered.length} 条结果 · ${allGroups.length} 组`}
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-[100px] rounded" />)}
        </div>
      ) : error ? (
        <EmptyState title="加载失败" description={error} />
      ) : displayEvents.length === 0 ? (
        <EmptyState title="暂无事件" description="等待数据采集完成后将显示事件。" />
      ) : groupBy !== 'none' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-surface px-4 py-3">
            <div className="min-w-0 text-[0.85rem] text-muted">
              <span className="font-semibold text-text">{groupModeLabel}</span>
              <span className="mx-2 text-subtle">/</span>
              <span>共 {allGroups.length} 组，{displayEvents.length} 条事件</span>
              {totalPages > 1 && (
                <>
                  <span className="mx-2 text-subtle">/</span>
                  <span>第 {currentPage} / {totalPages} 页，每页 {GROUP_PAGE_SIZE} 组</span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={expandCurrentPageGroups} disabled={visibleCollapsedCount === 0}>
                <ChevronDown size={14} /> 展开本页
              </Button>
              <Button size="sm" onClick={collapseCurrentPageGroups} disabled={pagedGroups.length === 0 || visibleCollapsedCount === pagedGroups.length}>
                <ChevronRight size={14} /> 收起本页
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {pagedGroups.map(renderGroup)}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2.5">
          {paged.map(renderEventCard)}
        </div>
      )}

      {!loading && !error && displayEvents.length > 0 && renderPagination()}
    </div>
  )
}
