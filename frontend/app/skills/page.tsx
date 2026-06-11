'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Puzzle } from 'lucide-react'
import { Button, Card, PageHeader } from '../components/ui'

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
    <div className="relative rounded border border-line bg-[#0f172a] p-4 text-slate-100">
      <Button size="sm" className="absolute right-3 top-3 border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white" onClick={copy}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? '已复制' : '复制'}
      </Button>
      <pre className="m-0 overflow-x-auto pr-24 font-mono text-[0.86rem] leading-relaxed">{value}</pre>
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
      <PageHeader title="Agent Skills" description="一行命令安装「Agent Memory 市场报告」Skill，让其他 Agent 能自动获取和推送每日/每周报告。" />

      <Card className="border-accent bg-accent-soft">
        <div className="mb-3 flex items-center gap-2 font-semibold text-accent">
            <Puzzle size={17} /> 让 Agent 安装此 Skill
        </div>
        <p className="mb-3 text-[0.875rem] leading-relaxed text-text">
          直接把下面这句话发给你的 Agent（Claude Code / Codex / Cursor / Gemini CLI），它会自动读取 SKILL.md 并执行安装：
        </p>
        <CodeBlock value={agentInstruction} />
        <p className="mt-3 text-[0.875rem] leading-relaxed text-muted">
          Agent 会访问上面的 SKILL.md 链接（纯文本 Markdown），读到安装命令后自动执行 <code>curl ... | bash</code> 完成安装；安装后可获取或推送日报和周报。
        </p>
      </Card>
    </div>
  )
}
