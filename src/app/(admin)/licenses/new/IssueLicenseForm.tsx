'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inputCls, lblCls } from '../_lib/styles'
import IssuedLicenseView from '../_components/IssuedLicenseView'
import clsx from 'clsx'

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
  const submitDisabled = loading || noProd || noCust

  return (
    <>
      {(noProd || noCust) && (
        <div className="px-3.5 py-2.5 border border-[rgba(240,144,80,0.25)] bg-[rgba(240,144,80,0.04)] mb-7 text-[11px] fg-orange">
          {noProd && 'Add a product first. '}
          {noCust && 'Add a customer first.'}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-5 mb-7">
          <div>
            <label className={lblCls}>Product</label>
            <select value={form.productId} onChange={e => set('productId', e.target.value)} required className={`form-input ${inputCls} cursor-pointer`}>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={lblCls}>Customer</label>
            <select value={form.customerId} onChange={e => set('customerId', e.target.value)} required className={`form-input ${inputCls} cursor-pointer`}>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 mb-7">
          <div>
            <label className={lblCls}>Tier</label>
            <select value={form.tier} onChange={e => set('tier', e.target.value)} className={`form-input ${inputCls} cursor-pointer`}>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className={lblCls}>Expires At</label>
            <input type="date" required value={form.expiresAt} onChange={e => set('expiresAt', e.target.value)} className={`form-input ${inputCls} [color-scheme:dark]`} />
          </div>
        </div>

        <div className="mb-7">
          <label className={lblCls}>
            Limits <span className="opacity-60 tracking-[0.1em]">(JSON)</span>
          </label>
          <textarea
            value={form.limits}
            onChange={e => set('limits', e.target.value)}
            rows={5}
            className={`form-input ${inputCls} border-b-0 bd-b px-3 py-2.5 resize-y leading-7 text-xs`}
          />
        </div>

        <div className="mb-7">
          <label className={lblCls}>
            Features <span className="opacity-60 tracking-[0.1em]">(comma-separated, optional)</span>
          </label>
          <input type="text" value={form.features} onChange={e => set('features', e.target.value)} placeholder="it_glue, white_label" className={`form-input ${inputCls}`} />
        </div>

        <div className="grid grid-cols-2 gap-5 mb-7">
          <div>
            <label className={lblCls}>Grace Period (days)</label>
            <input type="number" min={0} max={90} value={form.gracePeriodDays} onChange={e => set('gracePeriodDays', parseInt(e.target.value))} className={`form-input ${inputCls}`} />
          </div>
          <div>
            <label className={lblCls}>
              Heartbeat URL <span className="opacity-60 tracking-[0.1em]">(optional)</span>
            </label>
            <input type="url" value={form.heartbeatUrl} onChange={e => set('heartbeatUrl', e.target.value)} placeholder="https://license.example.com/api/v1/heartbeat" className={`form-input ${inputCls}`} />
          </div>
        </div>

        {error && (
          <div className="mb-5 px-3 py-2 border border-[rgba(240,96,96,0.25)] text-[11px] fg-red bg-[rgba(240,96,96,0.05)]">
            {error}
          </div>
        )}

        <div className="flex gap-4 items-center pt-1">
          <button
            type="submit"
            disabled={submitDisabled}
            className={clsx(
              'form-btn-primary font-[inherit] text-[10px] tracking-[0.22em] font-semibold fg-dark bg-amber border-0 px-[22px] py-[11px] uppercase transition-[background] duration-[120ms]',
              submitDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            )}
          >
            {loading ? 'Signing…' : 'Issue & Sign License →'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="form-btn-cancel font-[inherit] text-[10px] tracking-[0.18em] fg-muted bg-none border-0 cursor-pointer uppercase transition-colors duration-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  )
}
