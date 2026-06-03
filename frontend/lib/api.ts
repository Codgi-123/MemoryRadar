function normalizeApiBase(value: string | undefined) {
  const raw = value?.trim()
  if (raw && raw !== 'undefined' && raw !== 'null') {
    return raw.replace(/\/+$/, '')
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

export const publicBase = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL) || 'same-origin /api'

async function parseErrorMessage(res: Response) {
  try {
    const payload = await res.json()
    if (typeof payload?.detail === 'string') return payload.detail
    if (Array.isArray(payload?.detail)) return payload.detail.map((item: { msg?: string }) => item.msg || JSON.stringify(item)).join('; ')
  } catch {}
  return `API error: ${res.status}`
}

async function ensureOk(res: Response) {
  if (!res.ok) throw new Error(await parseErrorMessage(res))
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, { cache: 'no-store' })
  await ensureOk(res)
  return res.json()
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  await ensureOk(res)
  return res.json()
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await ensureOk(res)
  return res.json()
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${apiBase()}${path}`, { method: 'DELETE' })
  await ensureOk(res)
}

interface ReportContext {
  target_date: string
}

export async function getAppTargetDate(): Promise<string> {
  const context = await apiGet<ReportContext>('/api/system/status')
  return context.target_date
}

function parseDateOnly(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function parseApiDateTime(dateStr: string) {
  const dateOnly = parseDateOnly(dateStr)
  if (dateOnly) return dateOnly

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(dateStr)
  return new Date(hasTimezone ? dateStr : `${dateStr}Z`)
}

export function formatDate(dateStr: string): string {
  const d = parseDateOnly(dateStr) || parseApiDateTime(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatDateTime(dateStr: string): string {
  const d = parseApiDateTime(dateStr)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function formatRelativeTime(dateStr: string): string {
  const then = parseApiDateTime(dateStr).getTime()
  if (Number.isNaN(then)) return '-'

  const diff = Date.now() - then
  const absDiff = Math.abs(diff)
  const mins = Math.floor(absDiff / 60000)
  const suffix = diff >= 0 ? '前' : '后'
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟${suffix}`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时${suffix}`
  const days = Math.floor(hours / 24)
  return `${days} 天${suffix}`
}

export const relativeTime = formatRelativeTime
