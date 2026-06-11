import { AdminStatusBar } from '../components/AdminGate'
import { apiGet } from '@/lib/server-api'
import { Card, PageHeader } from '../components/ui'

interface SettingsStatus {
  serper_search: boolean; serper_base_url: string; github: boolean
  openai: boolean; openai_base_url: string; anthropic: boolean
  anthropic_base_url: string; llm_provider: string; daily_run_time: string; weekly_run_time: string; timezone: string; admin_required: boolean
}

function Dot({ ok }: { ok: boolean }) {
  return <span className={`mr-2.5 inline-block h-2 w-2 rounded-full ${ok ? 'bg-success' : 'bg-danger'}`} />
}

function ConfigValue({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <div className="text-[0.8rem] text-muted">{label}</div>
      <div className={good === undefined ? 'font-semibold text-text' : good ? 'font-semibold text-success' : 'font-semibold text-danger'}>{value}</div>
    </div>
  )
}

export default async function SettingsPage() {
  let settings: SettingsStatus
  try {
    settings = await apiGet<SettingsStatus>('/api/settings/status')
  } catch {
    return (
      <div>
        <PageHeader title="系统设置" description="无法加载配置状态" />
      </div>
    )
  }

  const items = [
    { label: 'Serper Search API', ok: settings.serper_search, detail: settings.serper_base_url },
    { label: 'GitHub Token', ok: settings.github, detail: null },
    { label: 'OpenAI API', ok: settings.openai, detail: settings.openai_base_url },
    { label: 'Anthropic API', ok: settings.anthropic, detail: settings.anthropic_base_url },
  ]
  const envVars = [
    ['SERPER_API_KEY', 'your_key'],
    ['GITHUB_TOKEN', 'ghp_xxx'],
    ['OPENAI_API_KEY', 'sk-xxx'],
    ['OPENAI_BASE_URL', 'https://api.openai.com/v1'],
    ['ANTHROPIC_API_KEY', 'sk-ant-xxx'],
    ['LLM_PROVIDER', 'openai | anthropic'],
    ['DAILY_RUN_CRON_HOUR', '8'],
    ['DAILY_RUN_CRON_MINUTE', '30'],
    ['WEEKLY_RUN_CRON_DAY_OF_WEEK', 'wednesday'],
    ['WEEKLY_RUN_CRON_HOUR', '10'],
    ['WEEKLY_RUN_CRON_MINUTE', '0'],
    ['APP_TIMEZONE', 'Asia/Shanghai'],
    ['ADMIN_TOKEN', 'change-me-to-a-long-random-token'],
  ] as const

  return (
    <div>
      <PageHeader title="系统设置" description="查看 API 配置状态与运行参数（通过环境变量配置）" />

      <div className="grid grid-cols-2 gap-6 max-lg:grid-cols-1">
        <Card>
          <h3 className="mb-4 text-base font-semibold tracking-normal text-text">API 配置状态</h3>
          <div className="flex flex-col gap-3.5">
            {items.map((item) => (
              <div key={item.label} className="flex items-center">
                <Dot ok={item.ok} />
                <div>
                  <div className="text-[0.9rem] font-medium text-text">{item.label}</div>
                  {item.detail && <div className="text-[0.8rem] text-muted">{item.detail}</div>}
                  <div className={item.ok ? 'text-[0.8rem] text-success' : 'text-[0.8rem] text-danger'}>
                    {item.ok ? '已配置' : '未配置'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-semibold tracking-normal text-text">运行配置</h3>
          <div className="flex flex-col gap-3.5">
            <ConfigValue label="LLM Provider" value={settings.llm_provider} />
            <ConfigValue label="每日任务执行时间" value={settings.daily_run_time} />
            <ConfigValue label="每周任务执行时间" value={settings.weekly_run_time} />
            <ConfigValue label="时区" value={settings.timezone} />
            <ConfigValue label="公开写操作保护" value={settings.admin_required ? '已启用' : '未启用'} good={settings.admin_required} />
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h3 className="mb-3 text-base font-semibold tracking-normal text-text">环境变量说明</h3>
        <p className="mb-3 text-[0.8rem] text-muted">在 backend/.env 文件中配置以下变量：</p>
        <div className="rounded bg-bg p-4 font-mono text-[0.82rem] leading-[1.8] text-text">
          {envVars.map(([key, value]) => (
            <div key={key}><span className="text-accent">{key}</span>={value}</div>
          ))}
        </div>
      </Card>

      <div className="mt-6">
        <AdminStatusBar />
      </div>
    </div>
  )
}
