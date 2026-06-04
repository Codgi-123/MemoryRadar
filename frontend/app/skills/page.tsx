'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Puzzle } from 'lucide-react'

const configuredApiUrl = normalizeConfiguredApiUrl(process.env.NEXT_PUBLIC_API_URL)

function normalizeConfiguredApiUrl(value: string | undefined) {
  const raw = value?.trim()
  if (!raw || raw === 'undefined' || raw === 'null') return ''
  return raw
}

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

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {}
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
    return true
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

function CodeBlock({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (await copyText(value)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
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

  useEffect(() => {
    setApiBase(inferApiBase())
  }, [])

  const skillMdUrl = `${apiBase}/api/skill/SKILL.md`
  const agentInstruction = `参考 ${skillMdUrl} ，安装这个 Agent Skill`

  return (
    <div>
      <div className="page-header">
        <h1>Agent Skills</h1>
        <p>一行命令安装「Agent Memory 市场日报」Skill，让其他 Agent 能自动获取和推送每日日报。</p>
      </div>

      <div className="card" style={{ borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
        <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
            <Puzzle size={17} /> 让 Agent 安装此 Skill
          </span>
        </div>
        <p className="text-sm" style={{ marginBottom: 12 }}>
          直接把下面这句话发给你的 Agent（Claude Code / Codex / Cursor / Gemini CLI），它会自动读取 SKILL.md 并执行安装：
        </p>
        <CodeBlock value={agentInstruction} />
        <p className="text-muted text-sm" style={{ marginTop: 12 }}>
          Agent 会访问上面的 SKILL.md 链接（纯文本 Markdown），读到安装命令后自动执行 <code>curl ... | bash</code> 完成安装。
        </p>
      </div>
    </div>
  )
}
