import { apiGet, formatRelativeTime } from '@/lib/server-api'
import { Star, GitFork, GitCommit, Tag, AlertTriangle, ExternalLink } from 'lucide-react'

interface RadarItem {
  project: string; github_repo: string; stars: number; star_delta: number | null
  forks: number; open_issues_count: number; open_issue_delta: number | null
  recent_commit_count: number; new_release_count: number
  latest_release_tag: string | null; latest_release_url: string | null
  new_issue_count: number; closed_issue_count: number
  new_pr_count: number; closed_pr_count: number
  severe_issue_count: number; severe_issue_summary: string | null; pushed_at: string | null
}

export default async function RadarPage() {
  let items: RadarItem[] = []
  try {
    items = await apiGet<RadarItem[]>('/api/radar/projects')
  } catch {
    return (
      <div>
        <div className="page-header"><h1>项目雷达</h1><p>无法加载数据，请检查后端服务。</p></div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div>
        <div className="page-header"><h1>项目雷达</h1><p>开源项目 GitHub 活跃度雷达</p></div>
        <div className="empty-state"><h3>暂无数据</h3><p>请先运行数据采集任务。</p></div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>项目雷达</h1>
        <p>追踪开源项目的 Stars、版本发布、Issue/PR 和严重问题</p>
      </div>

      {/* 概览表格 */}
      <div className="table-wrapper" style={{ marginBottom: 32 }}>
        <table className="table">
          <thead>
            <tr>
              <th>项目</th>
              <th>Stars</th>
              <th>Forks</th>
              <th>新版本</th>
              <th>Issue (新/关)</th>
              <th>PR (新/关)</th>
              <th>严重 Issue</th>
              <th>最后推送</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.github_repo}>
                <td>
                  <a href={`https://github.com/${item.github_repo}`} target="_blank" rel="noopener" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {item.project} <ExternalLink size={12} />
                  </a>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>
                  {item.stars.toLocaleString()}
                  {item.star_delta !== null && item.star_delta !== 0 && (
                    <span style={{ color: item.star_delta > 0 ? 'var(--success)' : 'var(--danger)', marginLeft: 6, fontSize: '0.8rem' }}>
                      {item.star_delta > 0 ? '+' : ''}{item.star_delta}
                    </span>
                  )}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{item.forks.toLocaleString()}</td>
                <td>
                  {item.new_release_count > 0 ? (
                    <span className="badge badge--green">{item.new_release_count} 个</span>
                  ) : (
                    <span className="text-muted">无</span>
                  )}
                </td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{item.new_issue_count} / {item.closed_issue_count}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{item.new_pr_count} / {item.closed_pr_count}</td>
                <td>
                  {item.severe_issue_count > 0 ? (
                    <span className="badge badge--red">{item.severe_issue_count}</span>
                  ) : (
                    <span className="badge badge--green">0</span>
                  )}
                </td>
                <td className="text-muted text-sm">{item.pushed_at ? formatRelativeTime(item.pushed_at) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 详情卡片 */}
      <div className="grid-2">
        {items.map((item) => (
          <div key={item.github_repo} className="card animate-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{item.project}</h3>
                <a href={`https://github.com/${item.github_repo}`} target="_blank" rel="noopener" className="text-sm" style={{ color: 'var(--accent)' }}>{item.github_repo}</a>
              </div>
              {item.latest_release_tag && item.latest_release_url && (
                <a href={item.latest_release_url} target="_blank" rel="noopener" className="badge badge--green" style={{ textDecoration: 'none' }}>
                  <Tag size={12} /> {item.latest_release_tag}
                </a>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <Star size={14} style={{ color: 'var(--orange)', marginBottom: 4 }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '1.1rem' }}>{item.stars.toLocaleString()}</div>
                <div className="text-muted text-sm">Stars</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <GitFork size={14} style={{ color: 'var(--accent)', marginBottom: 4 }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '1.1rem' }}>{item.forks.toLocaleString()}</div>
                <div className="text-muted text-sm">Forks</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <GitCommit size={14} style={{ color: 'var(--success)', marginBottom: 4 }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '1.1rem' }}>{item.recent_commit_count}</div>
                <div className="text-muted text-sm">Commits</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Tag size={14} style={{ color: 'var(--purple)', marginBottom: 4 }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '1.1rem' }}>{item.new_release_count}</div>
                <div className="text-muted text-sm">Releases</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24, fontSize: '0.87rem', color: 'var(--muted)', marginBottom: 12 }}>
              <span>Issue: +{item.new_issue_count} / -{item.closed_issue_count} (共 {item.open_issues_count} open)</span>
              <span>PR: +{item.new_pr_count} / -{item.closed_pr_count}</span>
            </div>

            {item.severe_issue_count > 0 && item.severe_issue_summary && (
              <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontWeight: 600, marginBottom: 4 }}>
                  <AlertTriangle size={14} /> {item.severe_issue_count} 个严重 Issue
                </div>
                <div style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{item.severe_issue_summary}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
