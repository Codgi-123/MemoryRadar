'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Eye, Zap, Radio, FileText, Play, Settings, Puzzle, Menu, X, CalendarDays } from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { href: '/', label: '总览', icon: LayoutDashboard },
  { href: '/watchlist', label: '追踪列表', icon: Eye },
  { href: '/events', label: '事件流', icon: Zap },
  { href: '/radar', label: '项目雷达', icon: Radio },
  { href: '/reports', label: '日报', icon: FileText },
  { href: '/weekly', label: '周报', icon: CalendarDays },
  { href: '/jobs', label: '任务', icon: Play },
  { href: '/skills', label: 'Agent Skills', icon: Puzzle },
  { href: '/settings', label: '设置', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // 路由切换时自动关闭抽屉
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // 打开时禁止 body 滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[90] hidden h-14 items-center gap-3 border-b border-line bg-surface px-4 max-md:flex">
        <button className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-text transition hover:bg-line-soft" onClick={() => setOpen(true)} aria-label="打开菜单">
          <Menu size={22} />
        </button>
        <span className="text-base font-bold tracking-normal text-text">Memory Watcher</span>
      </header>

      {open && <div className="fixed inset-0 z-[99] animate-[fadeIn_200ms_ease] bg-slate-900/40 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}

      <aside className={clsx(
        'fixed left-0 top-0 z-[100] flex h-screen w-64 flex-col overflow-y-auto border-r border-line bg-surface px-4 py-6 transition-transform max-md:z-[200] max-md:-translate-x-full',
        open && 'max-md:translate-x-0 max-md:shadow-lg'
      )}>
        <div className="relative mb-4 border-b border-line-soft px-3 pb-6 text-text">
          <h1 className="whitespace-nowrap text-[1.45rem] font-bold leading-none tracking-normal">Memory Watcher</h1>
          <span className="mt-2 block whitespace-nowrap text-[0.88rem] font-semibold leading-snug tracking-normal text-muted">Agent Memory 市场追踪</span>
          <button className="absolute right-4 top-0 hidden h-8 w-8 items-center justify-center rounded-sm text-muted transition hover:bg-line-soft hover:text-text max-md:flex" onClick={() => setOpen(false)} aria-label="关闭菜单">
            <X size={20} />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-[0.9rem] font-medium text-muted transition hover:bg-line-soft hover:text-text',
                  isActive && 'bg-accent-soft text-accent'
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
