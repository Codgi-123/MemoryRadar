'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Puzzle, Send, Terminal } from 'lucide-react'

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || ''

type WebhookType = 'generic' | 'feishu' | 'dingtalk' | 'slack'

function inferApiBase() {
  if (typeof window === 'undefined') return configuredApiUrl || ''

  const pageUrl = new URL(window.location.href)
  const fallback = `${pageUrl.protocol}//${pageUrl.hostname}:8000`
  if (!configuredApiUrl) return fallback

  try {
    const configured = new URL(configuredApiUrl)
    const configuredIsLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(configured.hostname)
    const pageIsLocal = ['localhost', '127.0.0.1'].includes(pageUrl.hostname)
    if (configuredIsLocal && !pageIsLocal) {
      configured.hostname = pageUrl.hostname
      return configured.toString().replace(/\/$/, '')
    }
    return configured.toString().replace(/\/$/, '')
  } catch {
    return fallback
  }
}

function CodeBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="skill-code">
      <button className="btn btn-sm btn-secondary skill-copy" onClick={copy}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? '已复制' : '复制'}
      </button>
      <pre>{value}</pre>
    </div>
  )
}

export default function SkillsPage() {
  const [apiBase, setApiBase] = useState('')
  const [webhookType, setWebhookType] = useState<WebhookType>('generic')
  const [webhookUrl, setWebhookUrl] = useState('https://your-webhook-url')

  useEffect(() => {
    setApiBase(inferApiBase())
  }, [])

  const skillPath = 'skills/agent-memory-daily-report'
  const configJson = useMemo(() => JSON.stringify({
    api_base: apiBase || 'AUTO_DETECTED_API_BASE',
    webhook_url: webhookUrl,
    webhook_type: webhookType,
  }, null, 2), [apiBase, webhookType, webhookUrl])

  const envConfig = `export MEMORY_REPORT_API_BASE="${apiBase || 'AUTO_DETECTED_API_BASE'}"
export MEMORY_REPORT_WEBHOOK_URL="${webhookUrl}"
export MEMORY_REPORT_WEBHOOK_TYPE="${webhookType}"`

  const fetchToday = `python ${skillPath}/scripts/daily_report.py fetch --date today`
  const fetchJson = `python ${skillPath}/scripts/daily_report.py fetch --date today --format json`
  const pushToday = `python ${skillPath}/scripts/daily_report.py push --date today`
  const cronLine = `30 8 * * * cd /path/to/memory-watcher && MEMORY_REPORT_CONFIG=/path/to/.memory-report-skill.json python ${skillPath}/scripts/daily_report.py push --date today`

  return (
    <div>
      <div className="page-header">
        <h1>Agent Skills</h1>
        <p>为其他 Agent 配置“获取每日日报”和“定时推送每日日报”的可复用 Skill。</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Puzzle size={17} /> Skill 信息
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div className="text-muted text-sm">Skill 路径</div>
              <div className="text-mono">{skillPath}</div>
            </div>
            <div>
              <div className="text-muted text-sm">自动推导 API 地址</div>
              <input className="form-input text-mono" value={apiBase} onChange={(event) => setApiBase(event.target.value)} />
              <p className="text-muted text-sm" style={{ marginTop: 6 }}>
                页面会根据当前访问域名/IP 推导。部署到新机器时，如果前端仍配置 localhost，会自动替换成当前浏览器访问的 host。
              </p>
            </div>
            <a className="btn btn-secondary" href={`${apiBase}/api/reports/daily`} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} /> 测试日报 API
            </a>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Send size={17} /> 推送通道
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label>
              <div className="text-muted text-sm">Webhook 类型</div>
              <select className="form-select" value={webhookType} onChange={(event) => setWebhookType(event.target.value as WebhookType)}>
                <option value="generic">generic</option>
                <option value="feishu">feishu</option>
                <option value="dingtalk">dingtalk</option>
                <option value="slack">slack</option>
              </select>
            </label>
            <label>
              <div className="text-muted text-sm">Webhook URL</div>
              <input className="form-input text-mono" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} />
            </label>
          </div>
        </div>
      </div>

      <div className="card mt-6">
        <div className="card-header">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={17} /> 方式一：配置文件
          </span>
        </div>
        <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
          推荐给其他 Agent 使用。把下面内容保存为 `.memory-report-skill.json`，脚本会自动读取。
        </p>
        <CodeBlock value={configJson} />
      </div>

      <div className="card mt-6">
        <div className="card-header">方式二：环境变量</div>
        <CodeBlock value={envConfig} />
      </div>

      <div className="grid-2 mt-6">
        <div className="card">
          <div className="card-header">获取日报</div>
          <p className="text-muted text-sm" style={{ marginBottom: 12 }}>适合其他 Agent 拉取日报内容后再二次加工。</p>
          <CodeBlock value={fetchToday} />
          <CodeBlock value={fetchJson} />
        </div>
        <div className="card">
          <div className="card-header">推送与定时</div>
          <p className="text-muted text-sm" style={{ marginBottom: 12 }}>日报生成后执行推送。cron 时间建议晚于系统日报生成时间。</p>
          <CodeBlock value={pushToday} />
          <CodeBlock value={cronLine} />
        </div>
      </div>

      <div className="card mt-6">
        <div className="card-header">给其他 Agent 的引导 Prompt</div>
        <CodeBlock value={`Use $agent-memory-daily-report to fetch today's Agent Memory daily report from ${apiBase || 'AUTO_DETECTED_API_BASE'} and push it to the configured ${webhookType} channel. Preserve all Markdown source links.`} />
      </div>
    </div>
  )
}
