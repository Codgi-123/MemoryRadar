'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, Puzzle, Send, Terminal, Download } from 'lucide-react'

const configuredApiUrl = normalizeConfiguredApiUrl(process.env.NEXT_PUBLIC_API_URL)

function normalizeConfiguredApiUrl(value: string | undefined) {
  const raw = value?.trim()
  if (!raw || raw === 'undefined' || raw === 'null') return ''
  return raw
}

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

function CodeBlock({ value, label }: { value: string; label?: string }) {
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
      {label && <div className="text-muted text-sm" style={{ marginBottom: 6 }}>{label}</div>}
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

  const skillName = 'agent-memory-daily-report'
  const installUrl = `${apiBase}/api/skill/install.sh`

  const installCmd = `curl -fsSL ${installUrl} | bash`
  const installCodex = `SKILL_DIR=$HOME/.codex/skills/${skillName} bash <(curl -fsSL ${installUrl})`
  const installGemini = `SKILL_DIR=$HOME/.gemini/skills/${skillName} bash <(curl -fsSL ${installUrl})`

  const configJson = useMemo(() => JSON.stringify({
    api_base: apiBase || 'AUTO_DETECTED_API_BASE',
    webhook_url: webhookUrl,
    webhook_type: webhookType,
  }, null, 2), [apiBase, webhookType, webhookUrl])

  const fetchToday = `python scripts/daily_report.py fetch --date today`
  const fetchJson = `python scripts/daily_report.py fetch --date today --format json`
  const pushToday = `python scripts/daily_report.py push --date today`

  return (
    <div>
      <div className="page-header">
        <h1>Agent Skills</h1>
        <p>一行命令安装「Agent Memory 市场日报」Skill，让其他 Agent 能自动获取和推送每日日报。</p>
      </div>

      {/* 一键安装 */}
      <div className="card">
        <div className="card-header">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Download size={17} /> 一键安装
          </span>
        </div>
        <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
          在终端执行以下命令，Skill 文件会自动下载到 Agent 的 skills 目录，并生成包含当前 API 地址的配置文件。
        </p>

        <CodeBlock label="Claude Code（默认）" value={installCmd} />
        <CodeBlock label="Codex CLI" value={installCodex} />
        <CodeBlock label="Gemini CLI" value={installGemini} />

        <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <a className="btn btn-secondary" href={installUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> 查看 install.sh
          </a>
          <a className="btn btn-secondary" href={`${apiBase}/api/skill/SKILL.md`} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> 查看 SKILL.md
          </a>
        </div>
      </div>

      <div className="grid-2 mt-6">
        <div className="card">
          <div className="card-header">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Puzzle size={17} /> Skill 信息
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div className="text-muted text-sm">Skill 名称</div>
              <div className="text-mono">{skillName}</div>
            </div>
            <div>
              <div className="text-muted text-sm">API 地址</div>
              <input className="form-input text-mono" value={apiBase} onChange={(event) => setApiBase(event.target.value)} />
              <p className="text-muted text-sm" style={{ marginTop: 6 }}>
                页面根据当前访问域名自动推导。修改后安装命令同步更新。
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

      {/* 手动配置 */}
      <div className="card mt-6">
        <div className="card-header">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={17} /> 手动配置（可选）
          </span>
        </div>
        <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
          一键安装已自动生成配置文件。如需手动修改 webhook 设置，编辑 Skill 目录下的 <code>.memory-report-skill.json</code>：
        </p>
        <CodeBlock value={configJson} />
      </div>

      {/* 使用示例 */}
      <div className="grid-2 mt-6">
        <div className="card">
          <div className="card-header">获取日报</div>
          <p className="text-muted text-sm" style={{ marginBottom: 12 }}>安装后在 Skill 目录下执行：</p>
          <CodeBlock value={fetchToday} />
          <CodeBlock label="JSON 格式（供 Agent 二次加工）" value={fetchJson} />
        </div>
        <div className="card">
          <div className="card-header">推送日报</div>
          <p className="text-muted text-sm" style={{ marginBottom: 12 }}>推送到配置的 webhook：</p>
          <CodeBlock value={pushToday} />
        </div>
      </div>

      <div className="card mt-6">
        <div className="card-header">给其他 Agent 的引导 Prompt</div>
        <CodeBlock value={`Use $agent-memory-daily-report to fetch today's Agent Memory daily report from ${apiBase || 'AUTO_DETECTED_API_BASE'} and push it to the configured ${webhookType} channel. Preserve all Markdown source links.`} />
      </div>
    </div>
  )
}
