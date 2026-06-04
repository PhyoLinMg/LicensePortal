'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCustomerPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', notes: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Failed')
      else router.push('/customers')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        .form-input { transition: border-color 0.15s; }
        .form-input:focus { border-bottom-color: var(--amber) !important; outline: none; }
        .form-input::placeholder { color: var(--tm); }
        .form-btn-primary:hover:not(:disabled) { background: var(--amber-d) !important; }
        .form-btn-cancel:hover { color: var(--t1) !important; }
      `}</style>

      <div style={{ padding: '32px 32px 0' }}>
        {/* Header */}
        <div style={{ paddingBottom: 24, borderBottom: '1px solid var(--bs)', marginBottom: 36 }}>
          <p style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--tm)', marginBottom: 8, textTransform: 'uppercase' }}>
            Customers / New
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--t1)', margin: 0, letterSpacing: '-0.02em' }}>
            Add Customer
          </h1>
        </div>

        <form onSubmit={handleSubmit} style={{ maxWidth: 440 }}>
          <Field label="Company / Customer Name" required>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Acme MSP"
              className="form-input"
              style={inputStyle}
            />
          </Field>

          <Field label="Email Address" hint="optional">
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="billing@acme.com"
              className="form-input"
              style={inputStyle}
            />
          </Field>

          <Field label="Notes" hint="optional">
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Stripe customer ID, contract details, renewal date…"
              className="form-input"
              style={{ ...inputStyle, resize: 'vertical', padding: '8px 0' }}
            />
          </Field>

          {error && <ErrorMsg>{error}</ErrorMsg>}

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 8 }}>
            <button
              type="submit"
              disabled={loading}
              className="form-btn-primary"
              style={primaryBtnStyle}
            >
              {loading ? 'Creating…' : 'Create Customer →'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="form-btn-cancel"
              style={cancelBtnStyle}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--b)',
  padding: '6px 0 8px',
  fontSize: 13,
  color: 'var(--t1)',
  fontFamily: 'inherit',
}

const primaryBtnStyle: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 10,
  letterSpacing: '0.22em',
  fontWeight: 600,
  color: '#07080d',
  background: 'var(--amber)',
  border: 'none',
  padding: '11px 20px',
  cursor: 'pointer',
  textTransform: 'uppercase',
  transition: 'background 0.12s',
}

const cancelBtnStyle: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 10,
  letterSpacing: '0.18em',
  color: 'var(--tm)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textTransform: 'uppercase',
  transition: 'color 0.1s',
}

function Field({ label, hint, required, children }: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <label style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        fontSize: 9,
        letterSpacing: '0.25em',
        color: 'var(--tm)',
        marginBottom: 10,
        textTransform: 'uppercase',
      }}>
        {label}
        {hint && <span style={{ letterSpacing: '0.1em', opacity: 0.6 }}>({hint})</span>}
        {required && <span style={{ color: 'var(--amber)', fontSize: 10 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 20,
      padding: '8px 12px',
      border: '1px solid rgba(240,96,96,0.25)',
      fontSize: 11,
      color: 'var(--red)',
      background: 'rgba(240,96,96,0.05)',
    }}>
      {children}
    </div>
  )
}
