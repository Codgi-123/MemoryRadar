'use client'

import { useEffect, useState } from 'react'
import { apiGet, clearAdminToken, getAdminToken, setAdminToken } from '@/lib/api'

interface SettingsStatus {
  admin_required?: boolean
}

let adminRequiredPromise: Promise<boolean> | null = null

function fetchAdminRequired() {
  adminRequiredPromise ||= apiGet<SettingsStatus>('/api/settings/status')
    .then((status) => Boolean(status.admin_required))
    .catch(() => true)
  return adminRequiredPromise
}

interface AdminGateProps {
  children: React.ReactNode
  message?: string
}

export function AdminGate({ children, message = '公开访问模式下此操作需要管理员口令。' }: AdminGateProps) {
  const [adminRequired, setAdminRequired] = useState<boolean | null>(null)
  const [token, setToken] = useState('')
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    setToken(getAdminToken())
    setUnlocked(Boolean(getAdminToken()))
    fetchAdminRequired().then((required) => {
      setAdminRequired(required)
      if (!required) setUnlocked(true)
    })
  }, [])

  if (adminRequired === null) return null
  if (!adminRequired || unlocked) {
    return (
      <>
        {children}
        {adminRequired && (
          <button className="btn btn-sm btn-secondary" style={{ marginLeft: 8 }} onClick={() => { clearAdminToken(); setToken(''); setUnlocked(false) }}>
            退出管理员模式
          </button>
        )}
      </>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>管理员操作已保护</div>
      <p className="text-muted text-sm" style={{ marginBottom: 12 }}>{message}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="输入管理员口令"
          style={{ maxWidth: 260 }}
        />
        <button
          className="btn btn-primary"
          disabled={!token.trim()}
          onClick={() => { setAdminToken(token.trim()); setUnlocked(true) }}
        >
          解锁
        </button>
      </div>
    </div>
  )
}
