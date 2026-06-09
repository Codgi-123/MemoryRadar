import Link from 'next/link'
import { LayoutDashboard, Zap, Star, FileText, CheckCircle, XCircle, Clock, Loader, AlertTriangle } from 'lucide-react'
import { MarkdownContent } from '@/components/MarkdownContent'

export const dynamic = 'force-dynamic'

interface DashboardData {
  projects: number
  events_today: number
  important_events: number
  reports: number
  report_context: { total_events: number; is_cold_start: boolean; last_report_date: string | null }
  latest_report: { id: number; report_date: string; title: string; content_markdown: string } | null
  recent_jobs: { id: number; job_type: string; status: string; started_at: string; finished_at: string | null; error_message: string | null }[]
}

function normalizeApiBase(value: string | undefined) {
  const raw = value?.trim()
  if (raw && raw !== 'undefined' && raw !== 'null') {
    return raw.replace(/\/+$/, '')
  }
  return ''
}

const publicBase = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL) || 'same-origin /api'

function serverApiCandidates() {
  const values = [
    process.env.API_INTERNAL_URL,
    process.env.INTERNAL_API_BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ]
  return Array.from(new Set(values.map(normalizeApiBase).filter(Boolean)))
}

async function getDashboardData(): Promise<DashboardData> {
  let lastError: unknown
  for (const base of serverApiCandidates()) {
    try {
      const res = await fetch(`${base}/api/dashboard`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`API error from ${base}: ${res.status}`)
      return res.json()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Dashboard API request failed')
}

function formatDateTime(dateStr: string): string {
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(dateStr)
  const d = new Date(hasTimezone ? dateStr : `${dateStr}Z`)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default async function DashboardPage() {
  let data: DashboardData
  try {
    data = await getDashboardData()
  } catch (error) {
    console.error('Dashboard SSR fetch failed:', error)
    return (
      <div>
        <div className="page-header">
          <h1>总览</h1>
          <p>后端服务未响应，请检查 API 服务是否正常运行：{publicBase}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {data.report_context.is_cold_start && (
        <div className="cold-start-banner">
          <AlertTriangle size={16} />
          <span>系统处于冷启动阶段 — 建议先运行「数据采集」任务初始化基线数据。</span>
        </div>
      )}

      <div className="page-header">
        <h1>总览</h1>
        <p>Agent Memory 市场动态追踪系统概览</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card stat-card--blue">
          <div className="stat-card__icon"><LayoutDashboard size={18} /></div>
          <div className="stat-card__label">追踪项目</div>
          <div className="stat-card__value">{data.projects}</div>
        </div>
        <div className="stat-card stat-card--green">
          <div className="stat-card__icon"><Zap size={18} /></div>
          <div className="stat-card__label">今日事件</div>
          <div className="stat-card__value">{data.events_today}</div>
        </div>
        <div className="stat-card stat-card--orange">
          <div className="stat-card__icon"><Star size={18} /></div>
          <div className="stat-card__label">重要事件</div>
          <div className="stat-card__value">{data.important_events}</div>
        </div>
        <div className="stat-card stat-card--purple">
          <div className="stat-card__icon"><FileText size={18} /></div>
          <div className="stat-card__label">日报总数</div>
          <div className="stat-card__value">{data.reports}</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h3>{data.latest_report ? data.latest_report.title : '暂无日报'}</h3>
            {data.latest_report && <span className="text-muted text-sm">{data.latest_report.report_date}</span>}
          </div>
          {data.latest_report ? (
            <>
              <MarkdownContent content={data.latest_report.content_markdown.slice(0, 600)} />
              <div className="mt-4">
                <Link href="/reports" className="btn btn-secondary">查看完整日报 →</Link>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>尚未生成日报，请前往任务页面执行采集。</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>最近任务</h3>
          </div>
          {data.recent_jobs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.recent_jobs.map((job) => (
                <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  {job.status === 'success' && <CheckCircle size={16} style={{ color: 'var(--success)' }} />}
                  {job.status === 'failed' && <XCircle size={16} style={{ color: 'var(--danger)' }} />}
                  {job.status === 'running' && <Loader size={16} style={{ color: 'var(--accent)' }} />}
                  {!['success', 'failed', 'running'].includes(job.status) && <Clock size={16} style={{ color: 'var(--subtle)' }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="badge badge--blue">{job.job_type}</span>
                      <span className={`badge ${job.status === 'success' ? 'badge--green' : job.status === 'failed' ? 'badge--red' : job.status === 'running' ? 'badge--blue' : 'badge--gray'}`}>{job.status}</span>
                    </div>
                    <div className="text-muted text-sm" style={{ marginTop: 4 }}>{formatDateTime(job.started_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state"><p>暂无任务记录</p></div>
          )}
        </div>
      </div>
    </div>
  )
}
