'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiGet, clearAdminToken, getAdminToken, setAdminToken, verifyAdminToken } from '@/lib/client-api'
import { Badge, Button, Card, Input } from './ui'

interface SettingsStatus {
  admin_required?: boolean
}

interface AdminContextValue {
  adminRequired: boolean | null
  unlocked: boolean
  unlock: (token: string) => Promise<boolean>
  logout: () => void
}

const AdminContext = createContext<AdminContextValue | null>(null)

function useAdminContext() {
  const context = useContext(AdminContext)
  if (!context) throw new Error('Admin components must be used inside AdminProvider')
  return context
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [adminRequired, setAdminRequired] = useState<boolean | null>(null)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    const storedToken = getAdminToken()
    apiGet<SettingsStatus>('/api/settings/status')
      .then(async (status) => {
        const required = Boolean(status.admin_required)
        setAdminRequired(required)
        if (!required) {
          setUnlocked(true)
          return
        }
        if (storedToken && await verifyAdminToken(storedToken)) {
          setUnlocked(true)
        } else {
          clearAdminToken()
          setUnlocked(false)
        }
      })
      .catch(() => {
        clearAdminToken()
        setAdminRequired(true)
        setUnlocked(false)
      })
  }, [])

  const value = useMemo<AdminContextValue>(() => ({
    adminRequired,
    unlocked,
    unlock: async (token: string) => {
      if (!adminRequired) {
        setUnlocked(true)
        return true
      }
      const ok = await verifyAdminToken(token)
      if (ok) {
        setAdminToken(token)
        setUnlocked(true)
        return true
      }
      clearAdminToken()
      setUnlocked(false)
      return false
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
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  if (adminRequired !== true) return null

  const submit = async () => {
    if (!token.trim() || checking) return
    setChecking(true)
    setError('')
    const ok = await unlock(token.trim())
    if (!ok) setError('管理员口令不正确')
    setChecking(false)
  }

  return (
    <Card className="mb-[18px] flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div>
        <div className="font-semibold">{unlocked ? '管理员模式已开启' : '公开只读模式'}</div>
        <div className="text-[0.82rem] text-muted">
          {unlocked ? '可执行采集、回填、报告生成和增删改操作。' : '输入管理员口令后，才会显示会修改数据或消耗配额的操作。'}
        </div>
      </div>
      {unlocked ? (
        <Button size="sm" onClick={logout}>退出管理员模式</Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Input
            type="password"
            value={token}
            onChange={(event) => {
              setToken(event.target.value)
              setError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
            placeholder="管理员口令"
            className="max-w-[260px]"
          />
          <Button variant="primary" disabled={!token.trim() || checking} onClick={submit}>
            {checking ? '校验中...' : '解锁'}
          </Button>
          {error && <span className="self-center text-[0.82rem] text-danger">{error}</span>}
        </div>
      )}
    </Card>
  )
}

interface AdminGateProps {
  children: ReactNode
  message?: string
}

export function AdminGate({ children, message = '此操作需要先到设置页面底部解锁管理员模式。' }: AdminGateProps) {
  const { adminRequired, unlocked } = useAdminContext()

  if (adminRequired === null) return null
  if (!adminRequired || unlocked) return <>{children}</>

  return <Badge title={message}>需管理员解锁</Badge>
}
