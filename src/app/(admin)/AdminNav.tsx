'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

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
    <>
      <style>{`
        .nav-link { transition: color 0.1s; }
        .nav-link:hover { color: var(--t1) !important; }
        .logout-btn:hover { color: var(--t2) !important; }
      `}</style>
      <aside style={{
        width: 210,
        background: 'var(--s1)',
        borderRight: '1px solid var(--bs)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        minHeight: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 22px 18px', borderBottom: '1px solid var(--bs)' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.35em', color: 'var(--amber)', fontWeight: 600 }}>
            LSRV
          </div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--tm)', marginTop: 3, textTransform: 'uppercase' }}>
            License Portal
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 0' }}>
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/')
            return (
              <Link
                key={n.href}
                href={n.href}
                className="nav-link"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 22px',
                  borderLeft: `2px solid ${active ? 'var(--amber)' : 'transparent'}`,
                  color: active ? 'var(--amber)' : 'var(--t2)',
                  textDecoration: 'none',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: active ? 'var(--amber)' : 'var(--b)',
                  flexShrink: 0,
                  transition: 'background 0.1s',
                }} />
                {n.label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--bs)' }}>
          <button
            onClick={logout}
            className="logout-btn"
            style={{
              fontFamily: 'inherit',
              fontSize: 9,
              letterSpacing: '0.2em',
              color: 'var(--tm)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textTransform: 'uppercase',
            }}
          >
            Sign Out →
          </button>
        </div>
      </aside>
    </>
  )
}
