'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        router.push('/licenses')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Authentication failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        .lf-input { transition: border-color 0.15s; }
        .lf-input:focus { border-bottom-color: var(--amber) !important; outline: none; }
        .lf-input::placeholder { color: var(--tm); }
        .lf-btn:hover:not(:disabled) { background: var(--amber-d) !important; }
        .lf-btn:disabled { opacity: 0.6; cursor: wait; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(200,160,48,0.06) 0%, transparent 70%)',
      }}>

        {/* Wordmark */}
        <div style={{
          textAlign: 'center',
          marginBottom: 52,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'none' : 'translateY(14px)',
          transition: 'opacity 0.55s ease, transform 0.55s ease',
        }}>
          <div style={{ fontSize: 9, letterSpacing: '0.45em', color: 'var(--tm)', marginBottom: 18 }}>
            RESTRICTED SYSTEM
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--t1)', lineHeight: 1.1 }}>
            LICENSE<br />
            <span style={{ color: 'var(--amber)' }}>SERVER</span>
            <span style={{ color: 'var(--amber)', animation: 'blink 1.1s step-end infinite' }}>_</span>
          </div>
        </div>

        {/* Form card */}
        <div style={{
          width: '100%',
          maxWidth: 360,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'none' : 'translateY(14px)',
          transition: 'opacity 0.55s ease 0.12s, transform 0.55s ease 0.12s',
        }}>
          {/* Top rule */}
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--amber) 30%, var(--amber) 70%, transparent)',
            marginBottom: 36,
            opacity: 0.6,
          }} />

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 30 }}>
              <label style={{
                display: 'block',
                fontSize: 9,
                letterSpacing: '0.28em',
                color: 'var(--tm)',
                marginBottom: 10,
                textTransform: 'uppercase',
              }}>
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@yourcompany.com"
                className="lf-input"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--b)',
                  padding: '6px 0 8px',
                  fontSize: 13,
                  color: 'var(--t1)',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 36 }}>
              <label style={{
                display: 'block',
                fontSize: 9,
                letterSpacing: '0.28em',
                color: 'var(--tm)',
                marginBottom: 10,
                textTransform: 'uppercase',
              }}>
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="lf-input"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--b)',
                  padding: '6px 0 8px',
                  fontSize: 14,
                  color: 'var(--t1)',
                  fontFamily: 'inherit',
                  letterSpacing: '0.12em',
                }}
              />
            </div>

            {error && (
              <div style={{
                marginBottom: 20,
                padding: '8px 12px',
                border: '1px solid rgba(240,96,96,0.25)',
                fontSize: 11,
                color: 'var(--red)',
                letterSpacing: '0.04em',
                background: 'rgba(240,96,96,0.05)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="lf-btn"
              style={{
                width: '100%',
                background: 'var(--amber)',
                border: 'none',
                padding: '13px',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.35em',
                color: '#07080d',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textTransform: 'uppercase',
                transition: 'background 0.12s',
              }}
            >
              {loading ? 'Authenticating…' : 'Authenticate'}
            </button>
          </form>

          {/* Bottom rule */}
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--b), transparent)',
            marginTop: 36,
          }} />
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 40,
          fontSize: 9,
          letterSpacing: '0.22em',
          color: 'var(--tm)',
          textTransform: 'uppercase',
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.55s ease 0.28s',
        }}>
          Authorized Personnel Only
        </div>
      </div>
    </>
  )
}
