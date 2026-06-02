function normalizeApiBase(value: string | undefined) {
  const raw = value?.trim()
  if (raw && raw !== 'undefined' && raw !== 'null') {
    return raw.replace(/\/$/, '')
  }
  return ''
}

function isLoopbackHost(hostname: string) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname)
}

function browserApiBase() {
  const configured = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL)
  if (!configured) return ''

  try {
    const configuredUrl = new URL(configured)
    const pageHost = window.location.hostname
    if (isLoopbackHost(configuredUrl.hostname) && !isLoopbackHost(pageHost)) {
      return ''
    }
  } catch {
    return ''
  }

  return configured
}

function serverApiBase() {
  return (
    normalizeApiBase(process.env.API_INTERNAL_URL) ||
    normalizeApiBase(process.env.INTERNAL_API_BASE_URL) ||
    normalizeApiBase(process.env.NEXT_PUBLIC_API_URL) ||
    'http://localhost:8000'
  )
}

export function apiBase() {
  if (typeof window === 'undefined') return serverApiBase()
  return browserApiBase()
}

export const publicBase = ''

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${apiBase()}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

export const relativeTime = formatRelativeTime
