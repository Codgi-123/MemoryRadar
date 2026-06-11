import { apiGet, formatRelativeTime } from '@/lib/server-api'
import type { ReactNode } from 'react'
import { Star, GitFork, GitCommit, Tag, AlertTriangle, ExternalLink } from 'lucide-react'
import { Badge, Card, EmptyState, PageHeader, Table } from '../components/ui'

interface RadarItem {
  project: string; github_repo: string; stars: number; star_delta: number | null
  forks: number; open_issues_count: number; open_issue_delta: number | null
  recent_commit_count: number; new_release_count: number
  latest_release_tag: string | null; latest_release_url: string | null
  new_issue_count: number; closed_issue_count: number
  new_pr_count: number; closed_pr_count: number
  severe_issue_count: number; severe_issue_summary: string | null; pushed_at: string | null
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="mb-1 flex justify-center text-subtle">{icon}</div>
      <div className="font-mono text-[1.1rem] font-semibold leading-tight text-text">{value}</div>
      <div className="text-[0.8rem] text-muted">{label}</div>
    </div>
  )
}

export default async function RadarPage() {
  let items: RadarItem[] = []
  try {
    items = await apiGet<RadarItem[]>('/api/radar/projects')
  } catch {
    return (
      <div>
        <PageHeader title="项目雷达" description="无法加载数据，请检查后端服务。" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div>
        <PageHeader title="项目雷达" description="开源项目 GitHub 活跃度雷达" />
        <EmptyState title="暂无数据" description="请先运行数据采集任务。" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="项目雷达" description="追踪开源项目的 Stars、版本发布、Issue/PR 和严重问题" />

      {/* 概览表格 */}
      <Table className="mb-8">
        <table className="w-full min-w-[900px] border-collapse text-left text-[0.875rem]">
          <thead>
            <tr className="border-b border-line-soft bg-bg">
              {['项目', 'Stars', 'Forks', '新版本', 'Issue (新/关)', 'PR (新/关)', '严重 Issue', '最后推送'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-[0.75rem] font-semibold uppercase tracking-normal text-muted">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.github_repo} className="border-b border-line-soft last:border-b-0 hover:bg-bg">
                <td className="px-4 py-3">
                  <a href={`https://github.com/${item.github_repo}`} target="_blank" rel="noopener" className="flex items-center gap-1 font-semibold text-text no-underline hover:text-accent">
                    {item.project} <ExternalLink size={12} />
                  </a>
                </td>
                <td className="px-4 py-3 font-mono">
                  {item.stars.toLocaleString()}
                  {item.star_delta !== null && item.star_delta !== 0 && (
                    <span className={item.star_delta > 0 ? 'ml-1.5 text-[0.8rem] text-success' : 'ml-1.5 text-[0.8rem] text-danger'}>
                      {item.star_delta > 0 ? '+' : ''}{item.star_delta}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono">{item.forks.toLocaleString()}</td>
                <td className="px-4 py-3">
                  {item.new_release_count > 0 ? (
                    <Badge tone="green">{item.new_release_count} 个</Badge>
                  ) : (
                    <span className="text-muted">无</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono">{item.new_issue_count} / {item.closed_issue_count}</td>
                <td className="px-4 py-3 font-mono">{item.new_pr_count} / {item.closed_pr_count}</td>
                <td className="px-4 py-3">
                  {item.severe_issue_count > 0 ? (
                    <Badge tone="red">{item.severe_issue_count}</Badge>
                  ) : (
                    <Badge tone="green">0</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-[0.8rem] text-muted">{item.pushed_at ? formatRelativeTime(item.pushed_at) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Table>

      {/* 详情卡片 */}
      <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
        {items.map((item) => (
          <Card key={item.github_repo} className="animate-[fadeInUp_400ms_ease_both]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[1.1rem] font-bold tracking-normal text-text">{item.project}</h3>
                <a href={`https://github.com/${item.github_repo}`} target="_blank" rel="noopener" className="text-[0.85rem] text-accent no-underline hover:underline">{item.github_repo}</a>
              </div>
              {item.latest_release_tag && item.latest_release_url && (
                <a href={item.latest_release_url} target="_blank" rel="noopener" className="inline-flex items-center rounded-full bg-success-soft px-2.5 py-[3px] text-[0.75rem] font-medium text-success no-underline">
                  <Tag size={12} /> {item.latest_release_tag}
                </a>
              )}
            </div>

            <div className="mb-4 grid grid-cols-4 gap-3">
              <Metric icon={<Star size={14} className="text-orange" />} label="Stars" value={item.stars.toLocaleString()} />
              <Metric icon={<GitFork size={14} className="text-accent" />} label="Forks" value={item.forks.toLocaleString()} />
              <Metric icon={<GitCommit size={14} className="text-success" />} label="Commits" value={item.recent_commit_count} />
              <Metric icon={<Tag size={14} className="text-purple" />} label="Releases" value={item.new_release_count} />
            </div>

            <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[0.87rem] text-muted">
              <span>Issue: +{item.new_issue_count} / -{item.closed_issue_count} (共 {item.open_issues_count} open)</span>
              <span>PR: +{item.new_pr_count} / -{item.closed_pr_count}</span>
            </div>

            {item.severe_issue_count > 0 && item.severe_issue_summary && (
              <div className="rounded border border-danger bg-danger-soft px-3.5 py-2.5 text-[0.82rem]">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-danger">
                  <AlertTriangle size={14} /> {item.severe_issue_count} 个严重 Issue
                </div>
                <div className="whitespace-pre-wrap text-text">{item.severe_issue_summary}</div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
