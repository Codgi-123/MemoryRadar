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
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="ml-64 min-w-0 flex-1 px-6 py-6 md:px-[clamp(24px,2.5vw,48px)] md:py-[clamp(24px,2.5vw,48px)] max-md:ml-0 max-md:w-full max-md:px-4 max-md:pb-5 max-md:pt-[72px]">
              {children}
            </main>
          </div>
        </AdminProvider>
      </body>
    </html>
  )
}
