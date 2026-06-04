'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiGet, clearAdminToken, getAdminToken, setAdminToken } from '@/lib/api'

interface SettingsStatus {
  admin_required?: boolean
}

interface AdminContextValue {
  adminRequired: boolean | null
  unlocked: boolean
  unlock: (token: string) => void
  logout: () => void
}

const AdminContext = createContext<AdminContextValue | null>(null)

function useAdminContext() {
  const context = useContext(AdminContext)
  if (!context) throw new Error('Admin components must be used inside AdminProvider')
  return context
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [adminRequired, setAdminRequired] = useState<boolean | null>(null)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    const storedToken = getAdminToken()
    setUnlocked(Boolean(storedToken))
    apiGet<SettingsStatus>('/api/settings/status')
      .then((status) => {
        const required = Boolean(status.admin_required)
        setAdminRequired(required)
        if (!required) setUnlocked(true)
      })
      .catch(() => setAdminRequired(true))
  }, [])

  const value = useMemo<AdminContextValue>(() => ({
    adminRequired,
    unlocked,
    unlock: (token: string) => {
      setAdminToken(token)
      setUnlocked(true)
    },
    logout: () => {
      clearAdminToken()
      setUnlocked(false)
    },
  }), [adminRequired, unlocked])

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function AdminStatusBar() {
  const { adminRequired, unlocked, unlock, logout } = useAdminContext()
  const [token, setToken] = useState('')

  if (adminRequired !== true) return null

  return (
    <div className="card" style={{ marginBottom: 18, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontWeight: 600 }}>{unlocked ? '管理员模式已开启' : '公开只读模式'}</div>
        <div className="text-muted text-sm">
          {unlocked ? '可执行采集、回填、报告生成和增删改操作。' : '输入管理员口令后，才会显示会修改数据或消耗配额的操作。'}
        </div>
      </div>
      {unlocked ? (
        <button className="btn btn-sm btn-secondary" onClick={logout}>退出管理员模式</button>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && token.trim()) unlock(token.trim())
            }}
            placeholder="管理员口令"
            style={{ maxWidth: 260 }}
          />
          <button className="btn btn-primary" disabled={!token.trim()} onClick={() => unlock(token.trim())}>解锁</button>
        </div>
      )}
    </div>
  )
}

interface AdminGateProps {
  children: React.ReactNode
  message?: string
}

export function AdminGate({ children, message = '此操作需要先在页面顶部解锁管理员模式。' }: AdminGateProps) {
  const { adminRequired, unlocked } = useAdminContext()

  if (adminRequired === null) return null
  if (!adminRequired || unlocked) return <>{children}</>

  return <span className="badge badge--gray" title={message}>需管理员解锁</span>
}
