import type { Metadata } from 'next'
import { IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'LSRV — License Portal',
  description: 'License issuance and management portal',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable}>
      <body style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg)', color: 'var(--t1)', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
