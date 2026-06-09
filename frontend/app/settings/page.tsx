import { AdminStatusBar } from '../components/AdminGate'
import { apiGet } from '@/lib/server-api'

interface SettingsStatus {
  serper_search: boolean; serper_base_url: string; github: boolean
  openai: boolean; openai_base_url: string; anthropic: boolean
  anthropic_base_url: string; llm_provider: string; daily_run_time: string; weekly_run_time: string; timezone: string; admin_required: boolean
}

function Dot({ ok }: { ok: boolean }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ok ? 'var(--success)' : 'var(--danger)', marginRight: 10 }} />
}

export default async function SettingsPage() {
  let settings: SettingsStatus
  try {
    settings = await apiGet<SettingsStatus>('/api/settings/status')
  } catch {
    return (
      <div>
        <div className="page-header"><h1>系统设置</h1><p>无法加载配置状态</p></div>
      </div>
    )
  }

  const items = [
    { label: 'Serper Search API', ok: settings.serper_search, detail: settings.serper_base_url },
    { label: 'GitHub Token', ok: settings.github, detail: null },
    { label: 'OpenAI API', ok: settings.openai, detail: settings.openai_base_url },
    { label: 'Anthropic API', ok: settings.anthropic, detail: settings.anthropic_base_url },
  ]

  return (
    <div>
      <div className="page-header">
        <h1>系统设置</h1>
        <p>查看 API 配置状态与运行参数（通过环境变量配置）</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>API 配置状态</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {items.map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center' }}>
                <Dot ok={item.ok} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.label}</div>
                  {item.detail && <div className="text-muted text-sm">{item.detail}</div>}
                  <div className="text-sm" style={{ color: item.ok ? 'var(--success)' : 'var(--danger)' }}>
                    {item.ok ? '已配置' : '未配置'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>运行配置</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div className="text-muted text-sm">LLM Provider</div>
              <div style={{ fontWeight: 600 }}>{settings.llm_provider}</div>
            </div>
            <div>
              <div className="text-muted text-sm">每日任务执行时间</div>
              <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{settings.daily_run_time}</div>
            </div>
            <div>
              <div className="text-muted text-sm">每周任务执行时间</div>
              <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{settings.weekly_run_time}</div>
            </div>
            <div>
              <div className="text-muted text-sm">时区</div>
              <div style={{ fontWeight: 600 }}>{settings.timezone}</div>
            </div>
            <div>
              <div className="text-muted text-sm">公开写操作保护</div>
              <div style={{ fontWeight: 600, color: settings.admin_required ? 'var(--success)' : 'var(--danger)' }}>
                {settings.admin_required ? '已启用' : '未启用'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-6">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>环境变量说明</h3>
        <p className="text-muted text-sm" style={{ marginBottom: 12 }}>在 backend/.env 文件中配置以下变量：</p>
        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 16, fontFamily: 'var(--font-mono)', fontSize: '0.82rem', lineHeight: 1.8 }}>
          <div><span style={{color:'var(--accent)'}}>SERPER_API_KEY</span>=your_key</div>
          <div><span style={{color:'var(--accent)'}}>GITHUB_TOKEN</span>=ghp_xxx</div>
          <div><span style={{color:'var(--accent)'}}>OPENAI_API_KEY</span>=sk-xxx</div>
          <div><span style={{color:'var(--accent)'}}>OPENAI_BASE_URL</span>=https://api.openai.com/v1</div>
          <div><span style={{color:'var(--accent)'}}>ANTHROPIC_API_KEY</span>=sk-ant-xxx</div>
          <div><span style={{color:'var(--accent)'}}>LLM_PROVIDER</span>=openai | anthropic</div>
          <div><span style={{color:'var(--accent)'}}>DAILY_RUN_CRON_HOUR</span>=8</div>
          <div><span style={{color:'var(--accent)'}}>DAILY_RUN_CRON_MINUTE</span>=30</div>
          <div><span style={{color:'var(--accent)'}}>WEEKLY_RUN_CRON_DAY_OF_WEEK</span>=wednesday</div>
          <div><span style={{color:'var(--accent)'}}>WEEKLY_RUN_CRON_HOUR</span>=10</div>
          <div><span style={{color:'var(--accent)'}}>WEEKLY_RUN_CRON_MINUTE</span>=0</div>
          <div><span style={{color:'var(--accent)'}}>APP_TIMEZONE</span>=Asia/Shanghai</div>
          <div><span style={{color:'var(--accent)'}}>ADMIN_TOKEN</span>=change-me-to-a-long-random-token</div>
        </div>
      </div>

      <div className="mt-6">
        <AdminStatusBar />
      </div>
    </div>
  )
}
