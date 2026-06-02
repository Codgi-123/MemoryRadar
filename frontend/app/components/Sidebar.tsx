'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Eye, Zap, Radio, FileText, Play, Settings } from 'lucide-react'

const navItems = [
  { href: '/', label: '总览', icon: LayoutDashboard },
  { href: '/watchlist', label: '追踪列表', icon: Eye },
  { href: '/events', label: '事件流', icon: Zap },
  { href: '/radar', label: '项目雷达', icon: Radio },
  { href: '/reports', label: '日报', icon: FileText },
  { href: '/jobs', label: '任务', icon: Play },
  { href: '/settings', label: '设置', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>Memory Watcher</h1>
        <span>Agent Memory 市场追踪</span>
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
  )
}
