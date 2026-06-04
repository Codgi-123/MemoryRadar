import './globals.css'
import type { Metadata } from 'next'
import { Sidebar } from './components/Sidebar'
import { AdminProvider } from './components/AdminGate'

export const metadata: Metadata = {
  title: 'Memory Market Watcher',
  description: 'Agent Memory 市场动态追踪与日报系统',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AdminProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </AdminProvider>
      </body>
    </html>
  )
}
