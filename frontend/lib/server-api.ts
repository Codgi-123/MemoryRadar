import 'server-only'

function normalizeApiBase(value: string | undefined) {
  const raw = value?.trim()
  if (raw && raw !== 'undefined' && raw !== 'null') {
    return raw.replace(/\/+$/, '')
  }
  return ''
}

function serverApiCandidates() {
  const values = [
    process.env.API_INTERNAL_URL,
    process.env.INTERNAL_API_BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ]
  return Array.from(new Set(values.map(normalizeApiBase).filter(Boolean)))
}

async function parseErrorMessage(res: Response) {
  try {
    const payload = await res.json()
    if (typeof payload?.detail === 'string') return payload.detail
    if (Array.isArray(payload?.detail)) return payload?.detail.map((item: { msg?: string }) => item.msg || JSON.stringify(item)).join('; ')
  } catch {}
  return `API error: ${res.status}`
}

export const publicBase = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL) || 'same-origin /api'

export async function apiGet<T>(path: string): Promise<T> {
  let lastError: unknown
  for (const base of serverApiCandidates()) {
    try {
      const res = await fetch(`${base}${path}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await parseErrorMessage(res))
      return res.json()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`API request failed: ${path}`)
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
