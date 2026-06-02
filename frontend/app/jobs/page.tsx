'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Play, RefreshCw, Database, ChevronDown, ChevronRight } from 'lucide-react'
import { publicBase, formatDateTime } from '@/lib/api'

interface JobRunOut {
  id: number; job_type: string; status: string
  started_at: string; finished_at: string | null; error_message: string | null
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobRunOut[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${publicBase}/api/jobs`)
      setJobs(await res.json())
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  // 自动轮询
  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'running')
    if (hasRunning && !intervalRef.current) {
      intervalRef.current = setInterval(fetchJobs, 5000)
    } else if (!hasRunning && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [jobs, fetchJobs])

  const trigger = async (endpoint: string, label: string) => {
    setActing(label)
    try {
      await fetch(`${publicBase}${endpoint}`, { method: 'POST' })
      setTimeout(fetchJobs, 2000)
    } catch {} finally { setTimeout(() => setActing(null), 2000) }
  }

  const statusBadge = (s: string) => {
    if (s === 'running') return 'badge--blue'
    if (s === 'success') return 'badge--green'
    if (s === 'failed') return 'badge--red'
    return 'badge--gray'
  }

  return (
    <div>
      <div className="page-header">
        <h1>任务管理</h1>
        <p>手动触发采集、日报生成等后台任务</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={!!acting} onClick={() => trigger('/api/jobs/collect', 'collect')}>
          <Play size={15} /> {acting === 'collect' ? '提交中...' : '执行采集'}
        </button>
        <button className="btn btn-secondary" disabled={!!acting} onClick={() => trigger('/api/jobs/run-daily', 'daily')}>
          <RefreshCw size={15} /> {acting === 'daily' ? '提交中...' : '生成每日日报'}
        </button>
        <button className="btn btn-secondary" disabled={!!acting} onClick={() => trigger('/api/jobs/backfill', 'backfill')}>
          <Database size={15} /> {acting === 'backfill' ? '提交中...' : '回填 7 天'}
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
      ) : jobs.length === 0 ? (
        <div className="empty-state"><h3>暂无任务记录</h3><p>点击上方按钮执行第一个任务</p></div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>ID</th><th>类型</th><th>状态</th><th>开始时间</th><th>结束时间</th><th>错误</th></tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="text-mono text-sm">{job.id}</td>
                  <td><span className="badge badge--blue">{job.job_type}</span></td>
                  <td><span className={`badge ${statusBadge(job.status)}`}>{job.status}</span></td>
                  <td className="text-sm">{formatDateTime(job.started_at)}</td>
                  <td className="text-sm">{job.finished_at ? formatDateTime(job.finished_at) : '-'}</td>
                  <td>
                    {job.error_message ? (
                      <div>
                        <button className="btn btn-sm btn-secondary" onClick={() => setExpandedErrors(prev => {
                          const next = new Set(prev)
                          next.has(job.id) ? next.delete(job.id) : next.add(job.id)
                          return next
                        })}>
                          {expandedErrors.has(job.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          查看
                        </button>
                        {expandedErrors.has(job.id) && (
                          <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--danger)', maxWidth: 300, wordBreak: 'break-all' }}>{job.error_message}</div>
                        )}
                      </div>
                    ) : <span className="text-muted">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
