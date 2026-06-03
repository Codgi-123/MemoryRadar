'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Eye, Zap, Radio, FileText, Play, Settings, Puzzle, Menu, X, CalendarDays } from 'lucide-react'

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
      {/* 移动端顶部栏 */}
      <header className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setOpen(true)} aria-label="打开菜单">
          <Menu size={22} />
        </button>
        <span className="mobile-header-title">Memory Watcher</span>
      </header>

      {/* 遮罩层 */}
      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      {/* 侧边栏 */}
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <h1>Memory Watcher</h1>
          <span>Agent Memory 市场追踪</span>
          <button className="sidebar-close-btn" onClick={() => setOpen(false)} aria-label="关闭菜单">
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} className={`nav-link ${isActive ? 'active' : ''}`}>
                <Icon />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
