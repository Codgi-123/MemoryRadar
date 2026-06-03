'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, RefreshCw, CalendarDays } from 'lucide-react'
import { apiGet, apiPost, formatDate, formatRelativeTime } from '@/lib/api'
import { MarkdownContent } from '@/components/MarkdownContent'

interface ReportOut {
  id: number; report_date: string; report_type: string; title: string
  content_markdown: string; generated_by_model: string | null; created_at: string
}

export default function WeeklyPage() {
  const [reports, setReports] = useState<ReportOut[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const fetchReports = useCallback(async () => {
    try {
      const data = await apiGet<ReportOut[]>('/api/reports/weekly')
      setReports(data)
      if (data.length > 0) setExpandedIds(new Set([data[0].id]))
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  const generateWeekly = async () => {
    setGenerating(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      await apiPost(`/api/reports/weekly/${today}/regenerate`)
      await fetchReports()
    } catch {} finally { setGenerating(false) }
  }

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1>市场周报</h1>
          <p>从近 7 天日报中提取版本更新、功能进展与能力变化</p>
        </div>
        <button className="btn btn-primary" onClick={generateWeekly} disabled={generating}>
          <RefreshCw size={16} className={generating ? 'spin' : ''} />
          {generating ? '生成中...' : '生成本周周报'}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <CalendarDays size={40} style={{ opacity: 0.3 }} />
          <h3>暂无周报</h3>
          <p>每周三 10:00 自动生成，也可以点击上方按钮手动生成。</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map((r) => {
            const expanded = expandedIds.has(r.id)
            return (
              <div key={r.id} className="card animate-in" style={{ padding: 0, overflow: 'hidden' }}>
                <div onClick={() => toggleExpand(r.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', cursor: 'pointer', borderBottom: expanded ? '1px solid var(--line-soft)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.title}</div>
                      <div className="text-muted text-sm" style={{ marginTop: 2 }}>
                        截至 {formatDate(r.report_date)}
                        {r.generated_by_model && <span className="badge badge--gray" style={{ marginLeft: 8 }}>{r.generated_by_model}</span>}
                      </div>
                    </div>
                  </div>
                  <span className="text-muted text-sm">{formatRelativeTime(r.created_at)}</span>
                </div>
                {expanded && (
                  <div style={{ padding: '20px 24px' }}>
                    <MarkdownContent content={r.content_markdown} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
