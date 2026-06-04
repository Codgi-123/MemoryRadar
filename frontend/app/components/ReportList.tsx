'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronRight, FileText, RefreshCw } from 'lucide-react'
import { apiGet, apiPost, formatDate, formatRelativeTime, getAppTargetDate } from '@/lib/api'
import { MarkdownContent } from '@/components/MarkdownContent'
import { AdminGate } from './AdminGate'

export interface ReportOut {
  id: number
  report_date: string
  report_type: string
  title: string
  content_markdown: string
  generated_by_model: string | null
  created_at: string
}

interface ReportListProps {
  endpoint: string
  regenerateBase: string
  emptyIcon: 'daily' | 'weekly'
  emptyTitle: string
  emptyDescription: string
  generateLabel: string
  generatingLabel: string
  datePrefix?: string
}

function EmptyIcon({ type }: { type: 'daily' | 'weekly' }) {
  const Icon = type === 'weekly' ? CalendarDays : FileText
  return <Icon size={40} style={{ opacity: 0.3 }} />
}

export function ReportList({
  endpoint,
  regenerateBase,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  generateLabel,
  generatingLabel,
  datePrefix = '',
}: ReportListProps) {
  const [reports, setReports] = useState<ReportOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const fetchReports = useCallback(async () => {
    setError(null)
    try {
      const data = await apiGet<ReportOut[]>(endpoint)
      setReports(data)
      setExpandedIds(prev => prev.size > 0 || data.length === 0 ? prev : new Set([data[0].id]))
    } catch (err) {
      setError(err instanceof Error ? err.message : '报告加载失败')
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => { fetchReports() }, [fetchReports])

  const regenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const targetDate = await getAppTargetDate()
      const report = await apiPost<ReportOut>(`${regenerateBase}/${targetDate}/regenerate`)
      await fetchReports()
      setExpandedIds(new Set([report.id]))
    } catch (err) {
      setError(err instanceof Error ? err.message : '报告生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <AdminGate message="重新生成报告会调用 LLM 并消耗服务配额。">
          <button className="btn btn-primary" onClick={regenerate} disabled={generating}>
            <RefreshCw size={16} className={generating ? 'spin' : ''} />
            {generating ? generatingLabel : generateLabel}
          </button>
        </AdminGate>
      </div>

      {error && <div className="cold-start-banner" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <EmptyIcon type={emptyIcon} />
          <h3>{emptyTitle}</h3>
          <p>{emptyDescription}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map((report) => {
            const expanded = expandedIds.has(report.id)
            return (
              <div key={report.id} className="card animate-in" style={{ padding: 0, overflow: 'hidden' }}>
                <div onClick={() => toggleExpand(report.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', cursor: 'pointer', borderBottom: expanded ? '1px solid var(--line-soft)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <div>
                      <div style={{ fontWeight: 600 }}>{report.title}</div>
                      <div className="text-muted text-sm" style={{ marginTop: 2 }}>
                        {datePrefix}{formatDate(report.report_date)}
                        {report.generated_by_model && <span className="badge badge--gray" style={{ marginLeft: 8 }}>{report.generated_by_model}</span>}
                      </div>
                    </div>
                  </div>
                  <span className="text-muted text-sm">{formatRelativeTime(report.created_at)}</span>
                </div>
                {expanded && (
                  <div style={{ padding: '20px 24px' }}>
                    <MarkdownContent content={report.content_markdown} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
