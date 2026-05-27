import type { Metadata, Viewport } from 'next'
import './globals.css'
import ChatWidget from '@/components/ChatWidget'

export const metadata: Metadata = {
  title: '셀퓨전씨 리뷰 인사이트',
  description: '올리브영 실구매 리뷰 분석 · CellFusionC',
  robots: 'noindex',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FAFAF9',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-60 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-accent/[0.025] blur-3xl" />
        </div>
        <div className="relative">
          {children}
        </div>
        <ChatWidget />
      </body>
    </html>
  )
}
