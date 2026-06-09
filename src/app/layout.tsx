import type { Metadata } from 'next'
import { IBM_Plex_Mono } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Keyforge',
  description: 'License issuance and management',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read nonce set by middleware — Next.js uses it to nonce its own inline bootstrap scripts.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="en" className={mono.variable} {...(nonce ? { nonce } : {})}>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}
