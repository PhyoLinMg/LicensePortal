'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'

const NAV = [
  { href: '/licenses',   label: 'Licenses'   },
  { href: '/customers',  label: 'Customers'  },
  { href: '/products',   label: 'Products'   },
  { href: '/heartbeats', label: 'Heartbeats' },
  { href: '/audit',      label: 'Audit Log'  },
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className="w-[210px] bg-s1 bdr flex flex-col shrink-0 min-h-screen">
      {/* Logo */}
      <div className="px-[22px] pt-[22px] pb-[18px] bdb">
        <div className="text-xs tracking-[0.35em] fg-amber font-semibold">LSRV</div>
        <div className="text-[9px] tracking-[0.18em] fg-muted mt-[3px] uppercase">License Portal</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2.5">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + '/')
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                'nav-link flex items-center gap-2.5 px-[22px] py-[9px] no-underline text-[11px] tracking-[0.1em] uppercase',
                active ? 'fg-amber border-l-2 border-[var(--amber)]' : 'fg-t2 border-l-2 border-transparent',
              )}
            >
              <span className={clsx(
                'w-[5px] h-[5px] rounded-full shrink-0 transition-[background] duration-100',
                active ? 'bg-amber' : 'bg-[var(--b)]',
              )} />
              {n.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-[22px] py-3.5 bdt">
        <button
          onClick={logout}
          className="logout-btn font-[inherit] text-[9px] tracking-[0.2em] fg-muted bg-none border-0 cursor-pointer p-0 uppercase"
        >
          Sign Out →
        </button>
      </div>
    </aside>
  )
}
