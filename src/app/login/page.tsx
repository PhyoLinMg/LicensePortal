'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

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

  const fadeIn = 'transition-[opacity,transform] duration-[550ms] ease-[ease]'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(200,160,48,0.06)_0%,transparent_70%)]">

      {/* Wordmark */}
      <div className={clsx('text-center mb-[52px]', fadeIn, mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[14px]')}>
        <div className="text-[9px] tracking-[0.45em] fg-muted mb-[18px]">RESTRICTED SYSTEM</div>
        <div className="text-[34px] font-semibold tracking-[-0.025em] fg-t1 leading-[1.1]">
          LICENSE<br />
          <span className="fg-amber">SERVER</span>
          <span className="fg-amber [animation:blink_1.1s_step-end_infinite]">_</span>
        </div>
      </div>

      {/* Form card */}
      <div className={clsx('w-full max-w-[360px]', fadeIn, 'delay-[120ms]', mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[14px]')}>
        {/* Top rule */}
        <div className="h-px bg-[linear-gradient(90deg,transparent,var(--amber)_30%,var(--amber)_70%,transparent)] mb-9 opacity-60" />

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div className="mb-[30px]">
            <label className="block text-[9px] tracking-[0.28em] fg-muted mb-2.5 uppercase">
              Email Address
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@yourcompany.com"
              className="lf-input w-full bg-transparent bdb-b py-1.5 pb-2 text-[13px] fg-t1 font-[inherit]"
            />
          </div>

          {/* Password */}
          <div className="mb-9">
            <label className="block text-[9px] tracking-[0.28em] fg-muted mb-2.5 uppercase">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="lf-input w-full bg-transparent bdb-b py-1.5 pb-2 text-sm fg-t1 font-[inherit] tracking-[0.12em]"
            />
          </div>

          {error && (
            <div className="mb-5 px-3 py-2 border border-[rgba(240,96,96,0.25)] text-[11px] fg-red tracking-[0.04em] bg-[rgba(240,96,96,0.05)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="lf-btn w-full bg-amber border-0 py-[13px] text-[10px] font-semibold tracking-[0.35em] text-[#07080d] cursor-pointer font-[inherit] uppercase transition-[background] duration-[120ms]"
          >
            {loading ? 'Authenticating…' : 'Authenticate'}
          </button>
        </form>

        {/* Bottom rule */}
        <div className="h-px bg-[linear-gradient(90deg,transparent,var(--b),transparent)] mt-9" />
      </div>

      {/* Footer */}
      <div className={clsx('mt-10 text-[9px] tracking-[0.22em] fg-muted uppercase', fadeIn, 'delay-[280ms]', mounted ? 'opacity-100' : 'opacity-0')}>
        Authorized Personnel Only
      </div>
    </div>
  )
}
