'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, RefreshCw, FileText } from 'lucide-react'
import { publicBase, formatDate, formatRelativeTime } from '@/lib/api'
import { MarkdownContent } from '@/components/MarkdownContent'

interface ReportOut {
  id: number; report_date: string; report_type: string; title: string
  content_markdown: string; generated_by_model: string | null; created_at: string
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportOut[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`${publicBase}/api/reports/daily`)
      const data: ReportOut[] = await res.json()
      setReports(data)
      if (data.length > 0) setExpandedIds(new Set([data[0].id]))
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  const generateToday = async () => {
    setGenerating(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      await fetch(`${publicBase}/api/reports/daily/${today}/regenerate`, { method: 'POST' })
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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1>市场日报</h1><p>LLM 生成的 Agent Memory 市场每日简报</p></div>
        <button className="btn btn-primary" onClick={generateToday} disabled={generating}>
          <RefreshCw size={16} className={generating ? 'spin' : ''} />
          {generating ? '生成中...' : '生成今日日报'}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <FileText size={40} style={{ opacity: 0.3 }} />
          <h3>暂无日报</h3>
          <p>点击上方按钮生成第一份日报</p>
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
                        {formatDate(r.report_date)}
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
