'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronRight, FileText, RefreshCw } from 'lucide-react'
import { apiGet, apiPost, formatDate, formatRelativeTime, getAppTargetDate } from '@/lib/client-api'
import { MarkdownContent } from '@/components/MarkdownContent'
import { AdminGate } from './AdminGate'
import { Badge, Button, Card, EmptyState, Skeleton } from './ui'

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
  return <Icon size={40} className="mb-2 text-subtle opacity-40" />
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
      <div className="mb-4 flex justify-end">
        <AdminGate message="重新生成报告会调用 LLM 并消耗服务配额。">
          <Button variant="primary" onClick={regenerate} disabled={generating}>
            <RefreshCw size={16} className={generating ? 'animate-spin' : undefined} />
            {generating ? generatingLabel : generateLabel}
          </Button>
        </AdminGate>
      </div>

      {error && <div className="mb-4 flex items-center gap-2 rounded border border-warning bg-warning-soft px-4 py-3 text-[0.875rem] font-medium text-text">{error}</div>}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded" />)}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription}>
          <EmptyIcon type={emptyIcon} />
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((report) => {
            const expanded = expandedIds.has(report.id)
            return (
              <Card key={report.id} className="animate-[fadeInUp_400ms_ease_both] overflow-hidden p-0">
                <div
                  className="flex cursor-pointer items-center justify-between gap-4 px-6 py-4 transition hover:bg-bg max-md:items-start"
                  onClick={() => toggleExpand(report.id)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-text">{report.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.8rem] text-muted">
                        {datePrefix}{formatDate(report.report_date)}
                        {report.generated_by_model && <Badge>{report.generated_by_model}</Badge>}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-[0.8rem] text-muted">{formatRelativeTime(report.created_at)}</span>
                </div>
                {expanded && (
                  <div className="border-t border-line-soft px-6 py-5">
                    <MarkdownContent content={report.content_markdown} />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
