import Link from 'next/link'
import type { ReactNode } from 'react'
import { LayoutDashboard, Zap, Star, FileText, CheckCircle, XCircle, Clock, Loader, AlertTriangle } from 'lucide-react'
import { MarkdownContent } from '@/components/MarkdownContent'
import { Badge, Card, EmptyState, PageHeader } from './components/ui'
import type { Tone } from './components/ui'

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

function statusTone(status: string): Tone {
  if (status === 'success') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'running') return 'blue'
  return 'gray'
}

function StatCard({ tone, icon, label, value }: { tone: 'blue' | 'green' | 'orange' | 'purple'; icon: ReactNode; label: string; value: number }) {
  const toneClass = {
    blue: 'bg-accent-soft text-accent',
    green: 'bg-success-soft text-success',
    orange: 'bg-orange-soft text-orange',
    purple: 'bg-purple-soft text-purple',
  }[tone]

  return (
    <Card className="p-5">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded bg-current/10 ${toneClass}`}>
        {icon}
      </div>
      <div className="mb-1 text-[0.8rem] font-medium text-muted">{label}</div>
      <div className="font-mono text-3xl font-bold leading-none text-text">{value}</div>
    </Card>
  )
}

export default async function DashboardPage() {
  let data: DashboardData
  try {
    data = await getDashboardData()
  } catch (error) {
    console.error('Dashboard SSR fetch failed:', error)
    return (
      <div>
        <PageHeader title="总览" description={`后端服务未响应，请检查 API 服务是否正常运行：${publicBase}`} />
      </div>
    )
  }

  return (
    <div>
      {data.report_context.is_cold_start && (
        <div className="mb-6 flex items-center gap-2 rounded border border-warning bg-warning-soft px-4 py-3 text-[0.875rem] font-medium text-text">
          <AlertTriangle size={16} />
          <span>系统处于冷启动阶段 — 建议先运行「数据采集」任务初始化基线数据。</span>
        </div>
      )}

      <PageHeader title="总览" description="Agent Memory 市场动态追踪系统概览" />

      <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <StatCard tone="blue" icon={<LayoutDashboard size={18} />} label="追踪项目" value={data.projects} />
        <StatCard tone="green" icon={<Zap size={18} />} label="今日事件" value={data.events_today} />
        <StatCard tone="orange" icon={<Star size={18} />} label="重要事件" value={data.important_events} />
        <StatCard tone="purple" icon={<FileText size={18} />} label="日报总数" value={data.reports} />
      </div>

      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] gap-6 max-lg:grid-cols-1">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-line-soft pb-4">
            <h3 className="text-[1.05rem] font-semibold tracking-normal text-text">{data.latest_report ? data.latest_report.title : '暂无日报'}</h3>
            {data.latest_report && <span className="text-[0.8rem] text-muted">{data.latest_report.report_date}</span>}
          </div>
          {data.latest_report ? (
            <>
              <MarkdownContent content={data.latest_report.content_markdown.slice(0, 600)} />
              <div className="mt-4">
                <Link href="/reports" className="inline-flex items-center justify-center gap-2 rounded-sm border border-line bg-surface px-4 py-2.5 text-[0.875rem] font-medium text-muted no-underline transition hover:bg-line-soft hover:text-text">查看完整日报 →</Link>
              </div>
            </>
          ) : (
            <EmptyState description="尚未生成日报，请前往任务页面执行采集。" />
          )}
        </Card>

        <Card>
          <div className="mb-4 border-b border-line-soft pb-4">
            <h3 className="text-[1.05rem] font-semibold tracking-normal text-text">最近任务</h3>
          </div>
          {data.recent_jobs.length > 0 ? (
            <div className="flex flex-col gap-3">
              {data.recent_jobs.map((job) => (
                <div key={job.id} className="flex items-center gap-3 border-b border-line-soft py-2 last:border-b-0">
                  {job.status === 'success' && <CheckCircle size={16} className="text-success" />}
                  {job.status === 'failed' && <XCircle size={16} className="text-danger" />}
                  {job.status === 'running' && <Loader size={16} className="text-accent" />}
                  {!['success', 'failed', 'running'].includes(job.status) && <Clock size={16} className="text-subtle" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="blue">{job.job_type}</Badge>
                      <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                    </div>
                    <div className="mt-1 text-[0.8rem] text-muted">{formatDateTime(job.started_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState description="暂无任务记录" />
          )}
        </Card>
      </div>
    </div>
  )
}
