'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inputStyle, lblStyle } from '../_lib/styles'
import IssuedLicenseView from '../_components/IssuedLicenseView'

interface Product { id: string; name: string; slug: string }
interface Customer { id: string; name: string }

export default function IssueLicenseForm({
  products,
  customers,
}: {
  products: Product[]
  customers: Customer[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    productId: products[0]?.id ?? '',
    customerId: customers[0]?.id ?? '',
    tier: 'pro',
    expiresAt: '',
    gracePeriodDays: 21,
    heartbeatUrl: '',
    features: '',
    limits: '{\n  "max_clients": 50,\n  "max_intake_per_month": 500,\n  "max_msp_users": 10\n}',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [issued, setIssued] = useState<{ licenseText: string; id: string } | null>(null)

  function set(key: string, value: string | number) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    let limits: Record<string, number>
    try {
      limits = JSON.parse(form.limits)
    } catch {
      setError('Limits must be valid JSON')
      setLoading(false)
      return
    }

    const features = form.features.split(',').map(f => f.trim()).filter(Boolean)

    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: form.productId,
          customerId: form.customerId,
          tier: form.tier,
          expiresAt: form.expiresAt,
          gracePeriodDays: form.gracePeriodDays,
          heartbeatUrl: form.heartbeatUrl || undefined,
          features,
          limits,
        }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Failed to issue license')
      else setIssued({ licenseText: data.licenseText, id: data.id })
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (issued) {
    return <IssuedLicenseView licenseText={issued.licenseText} licenseId={issued.id} />
  }

  const noProd = products.length === 0
  const noCust = customers.length === 0

  return (
    <>
      <style>{`
        .form-input { transition: border-color 0.15s; }
        .form-input:focus { border-bottom-color: var(--amber) !important; outline: none; }
        .form-input::placeholder { color: var(--tm); }
        .form-input option { background: #0f1120; color: var(--t1); }
        .form-btn-primary:hover:not(:disabled) { background: var(--amber-d) !important; }
        .form-btn-cancel:hover { color: var(--t1) !important; }
      `}</style>

      {(noProd || noCust) && (
        <div style={{
          padding: '10px 14px',
          border: '1px solid rgba(240,144,80,0.25)',
          background: 'rgba(240,144,80,0.04)',
          marginBottom: 28,
          fontSize: 11,
          color: 'var(--orange)',
        }}>
          {noProd && 'Add a product first. '}
          {noCust && 'Add a customer first.'}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          <div>
            <label style={lblStyle}>Product</label>
            <select value={form.productId} onChange={e => set('productId', e.target.value)} required className="form-input" style={{ ...inputStyle, cursor: 'pointer' }}>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lblStyle}>Customer</label>
            <select value={form.customerId} onChange={e => set('customerId', e.target.value)} required className="form-input" style={{ ...inputStyle, cursor: 'pointer' }}>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          <div>
            <label style={lblStyle}>Tier</label>
            <select value={form.tier} onChange={e => set('tier', e.target.value)} className="form-input" style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label style={lblStyle}>Expires At</label>
            <input type="date" required value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} className="form-input" style={{ ...inputStyle, colorScheme: 'dark' }} />
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={lblStyle}>
            Limits <span style={{ opacity: 0.6, letterSpacing: '0.1em' }}>(JSON)</span>
          </label>
          <textarea
            value={form.limits}
            onChange={e => set('limits', e.target.value)}
            rows={5}
            className="form-input"
            style={{ ...inputStyle, borderBottom: 'none', border: '1px solid var(--b)', padding: '10px 12px', resize: 'vertical', lineHeight: 1.7, fontSize: 12 }}
          />
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={lblStyle}>
            Features <span style={{ opacity: 0.6, letterSpacing: '0.1em' }}>(comma-separated, optional)</span>
          </label>
          <input type="text" value={form.features} onChange={e => set('features', e.target.value)} placeholder="it_glue, white_label" className="form-input" style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          <div>
            <label style={lblStyle}>Grace Period (days)</label>
            <input type="number" min={0} max={90} value={form.gracePeriodDays} onChange={e => set('gracePeriodDays', parseInt(e.target.value))} className="form-input" style={inputStyle} />
          </div>
          <div>
            <label style={lblStyle}>
              Heartbeat URL <span style={{ opacity: 0.6, letterSpacing: '0.1em' }}>(optional)</span>
            </label>
            <input type="url" value={form.heartbeatUrl} onChange={e => set('heartbeatUrl', e.target.value)} placeholder="https://license.example.com/api/v1/heartbeat" className="form-input" style={inputStyle} />
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 20, padding: '8px 12px', border: '1px solid rgba(240,96,96,0.25)', fontSize: 11, color: 'var(--red)', background: 'rgba(240,96,96,0.05)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 4 }}>
          <button
            type="submit"
            disabled={loading || noProd || noCust}
            className="form-btn-primary"
            style={{
              fontFamily: 'inherit',
              fontSize: 10,
              letterSpacing: '0.22em',
              fontWeight: 600,
              color: '#07080d',
              background: 'var(--amber)',
              border: 'none',
              padding: '11px 22px',
              cursor: loading || noProd || noCust ? 'not-allowed' : 'pointer',
              opacity: loading || noProd || noCust ? 0.5 : 1,
              textTransform: 'uppercase',
              transition: 'background 0.12s',
            }}
          >
            {loading ? 'Signing…' : 'Issue & Sign License →'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="form-btn-cancel"
            style={{
              fontFamily: 'inherit',
              fontSize: 10,
              letterSpacing: '0.18em',
              color: 'var(--tm)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'color 0.1s',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  )
}
