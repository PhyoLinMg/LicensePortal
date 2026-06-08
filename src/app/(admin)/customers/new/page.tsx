'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const inputCls = 'form-input w-full bg-transparent bdb-b py-1.5 pb-2 text-[13px] fg-t1 font-[inherit]'
const primBtnCls = 'form-btn-primary font-[inherit] text-[10px] tracking-[0.22em] font-semibold fg-dark bg-amber border-0 px-5 py-[11px] cursor-pointer uppercase transition-[background] duration-[120ms]'
const cancelBtnCls = 'form-btn-cancel font-[inherit] text-[10px] tracking-[0.18em] fg-muted bg-none border-0 cursor-pointer uppercase transition-colors duration-100'

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
    <div className="px-8 pt-8">
      {/* Header */}
      <div className="pb-6 bdb mb-9">
        <p className="text-[9px] tracking-[0.28em] fg-muted mb-2 uppercase">Customers / New</p>
        <h1 className="text-[20px] font-semibold fg-t1 m-0 tracking-[-0.02em]">Add Customer</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-[440px]">
        <Field label="Company / Customer Name" required>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Acme MSP"
            className={inputCls}
          />
        </Field>

        <Field label="Email Address" hint="optional">
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="billing@acme.com"
            className={inputCls}
          />
        </Field>

        <Field label="Notes" hint="optional">
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3}
            placeholder="Stripe customer ID, contract details, renewal date…"
            className={`${inputCls} resize-y py-2`}
          />
        </Field>

        {error && <ErrorMsg>{error}</ErrorMsg>}

        <div className="flex gap-4 items-center pt-2">
          <button type="submit" disabled={loading} className={primBtnCls}>
            {loading ? 'Creating…' : 'Create Customer →'}
          </button>
          <button type="button" onClick={() => router.back()} className={cancelBtnCls}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="mb-7">
      <label className="flex items-baseline gap-2 text-[9px] tracking-[0.25em] fg-muted mb-2.5 uppercase">
        {label}
        {hint && <span className="tracking-[0.1em] opacity-60">({hint})</span>}
        {required && <span className="fg-amber text-[10px]">*</span>}
      </label>
      {children}
    </div>
  )
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 px-3 py-2 border border-[rgba(240,96,96,0.25)] text-[11px] fg-red bg-[rgba(240,96,96,0.05)]">
      {children}
    </div>
  )
}
