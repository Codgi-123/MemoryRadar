'use client'

import { useState, useEffect, useCallback } from 'react'
import { Play, RefreshCw, Database, ChevronDown, ChevronRight } from 'lucide-react'
import { apiGet, apiPost, formatDateTime } from '@/lib/client-api'
import { AdminGate } from '../components/AdminGate'
import { Badge, Button, EmptyState, PageHeader, Skeleton, Table } from '../components/ui'
import type { Tone } from '../components/ui'

interface JobRunOut {
  id: number; job_type: string; status: string
  started_at: string; finished_at: string | null; error_message: string | null
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRunOut[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set())

  const fetchJobs = useCallback(async () => {
    try {
      setJobs(await apiGet<JobRunOut[]>('/api/jobs'))
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  // 有运行中任务时轮询；每次 effect 清理对应 interval，避免 ref 指向已清理定时器后停止轮询。
  useEffect(() => {
    if (!jobs.some(j => j.status === 'running')) return
    const intervalId = window.setInterval(fetchJobs, 5000)
    return () => window.clearInterval(intervalId)
  }, [jobs, fetchJobs])

  const trigger = async (endpoint: string, label: string) => {
    setActing(label)
    try {
      await apiPost(endpoint)
      setTimeout(fetchJobs, 2000)
    } catch {} finally { setTimeout(() => setActing(null), 2000) }
  }

  const statusTone = (s: string): Tone => {
    if (s === 'running') return 'blue'
    if (s === 'success') return 'green'
    if (s === 'failed') return 'red'
    return 'gray'
  }

  return (
    <div>
      <PageHeader title="任务管理" description="手动触发采集、日报生成等后台任务" />

      <AdminGate message="采集、回填和报告生成会消耗搜索 / GitHub / LLM 配额。">
        <div className="mb-7 flex flex-wrap gap-2.5">
          <Button variant="primary" disabled={!!acting} onClick={() => trigger('/api/jobs/collect', 'collect')}>
            <Play size={15} /> {acting === 'collect' ? '提交中...' : '执行采集'}
          </Button>
          <Button disabled={!!acting} onClick={() => trigger('/api/jobs/run-daily', 'daily')}>
            <RefreshCw size={15} /> {acting === 'daily' ? '提交中...' : '生成每日日报'}
          </Button>
          <Button disabled={!!acting} onClick={() => trigger('/api/jobs/run-weekly', 'weekly')}>
            <RefreshCw size={15} /> {acting === 'weekly' ? '提交中...' : '生成每周周报'}
          </Button>
          <Button disabled={!!acting} onClick={() => trigger('/api/jobs/backfill', 'backfill')}>
            <Database size={15} /> {acting === 'backfill' ? '提交中...' : '回填 7 天'}
          </Button>
        </div>
      </AdminGate>

      {loading ? (
        <Skeleton className="h-[300px] rounded" />
      ) : jobs.length === 0 ? (
        <EmptyState title="暂无任务记录" description="点击上方按钮执行第一个任务" />
      ) : (
        <Table>
          <table className="w-full min-w-[760px] border-collapse text-left text-[0.875rem]">
            <thead>
              <tr className="border-b border-line-soft bg-bg">
                {['ID', '类型', '状态', '开始时间', '结束时间', '错误'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-[0.75rem] font-semibold uppercase tracking-normal text-muted">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-line-soft last:border-b-0 hover:bg-bg">
                  <td className="px-4 py-3 font-mono text-[0.85rem]">{job.id}</td>
                  <td className="px-4 py-3"><Badge tone="blue">{job.job_type}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={statusTone(job.status)}>{job.status}</Badge></td>
                  <td className="px-4 py-3 text-[0.85rem]">{formatDateTime(job.started_at)}</td>
                  <td className="px-4 py-3 text-[0.85rem]">{job.finished_at ? formatDateTime(job.finished_at) : '-'}</td>
                  <td className="px-4 py-3">
                    {job.error_message ? (
                      <div>
                        <Button size="sm" onClick={() => setExpandedErrors(prev => {
                          const next = new Set(prev)
                          next.has(job.id) ? next.delete(job.id) : next.add(job.id)
                          return next
                        })}>
                          {expandedErrors.has(job.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          查看
                        </Button>
                        {expandedErrors.has(job.id) && (
                          <div className="mt-1.5 max-w-[300px] break-all text-[0.78rem] text-danger">{job.error_message}</div>
                        )}
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Table>
      )}
    </div>
  )
}
