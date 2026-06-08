'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

const inputCls = 'form-input w-full bg-transparent bdb-b py-1.5 pb-2 text-[13px] fg-t1 font-[inherit]'
const lblCls = 'block text-[9px] tracking-[0.25em] fg-muted mb-2.5 uppercase'
const primBtnCls = 'form-btn-primary font-[inherit] text-[10px] tracking-[0.22em] font-semibold fg-dark bg-amber border-0 px-5 py-[11px] cursor-pointer uppercase transition-[background] duration-[120ms]'
const cancelBtnCls = 'form-btn-cancel font-[inherit] text-[10px] tracking-[0.18em] fg-muted bg-none border-0 cursor-pointer uppercase transition-colors duration-100'

export default function NewProductPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', slug: '', keyId: 'v1', issuerName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<{
    id: string; name: string; slug: string; keyId: string; publicKeyB64: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  function set(k: string, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    if (k === 'name' && !form.slug) {
      setForm(f => ({
        ...f,
        slug: v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          keyId: form.keyId,
          issuerName: form.issuerName || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Failed')
      else setCreated(data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (created) {
    return (
      <div className="p-8">
        <div className="pb-6 bdb mb-8">
          <p className="text-[9px] tracking-[0.28em] fg-muted mb-2 uppercase">Products / New</p>
          <h1 className="text-[20px] font-semibold fg-t1 m-0 tracking-[-0.02em]">Keypair Generated</h1>
        </div>

        <div className="px-4 py-3 border border-[rgba(61,214,140,0.2)] bg-[rgba(61,214,140,0.04)] mb-7 text-[11px] fg-green tracking-[0.04em]">
          Product created — Ed25519 keypair generated. Private key encrypted at rest.
        </div>

        <div className="mb-7 max-w-[640px]">
          <div className="text-[9px] tracking-[0.22em] fg-muted uppercase mb-2.5">
            Public Key — embed in product binary
          </div>
          <div className="text-[9px] fg-muted mb-2.5">
            Copy into{' '}
            <code className="fg-t2">application.yml</code>
            {' '}under{' '}
            <code className="fg-t2">app.license.public-keys.{created.keyId}</code>
          </div>
          <div className="bg-s1 bd px-4 py-3.5 flex gap-3.5 items-start">
            <code className="text-[10px] fg-t2 flex-1 break-all leading-7">{created.publicKeyB64}</code>
            <button
              onClick={() => copy(created.publicKeyB64)}
              className={clsx(
                'key-copy-btn font-[inherit] text-[9px] tracking-[0.2em] bg-none border-0 cursor-pointer uppercase shrink-0 transition-colors duration-[150ms]',
                copied ? 'fg-green' : 'fg-t2',
              )}
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-[320px] py-4 bdt bdb mb-7">
          <MetaItem label="Slug" value={created.slug} />
          <MetaItem label="Key ID" value={created.keyId} />
        </div>

        <button
          onClick={() => router.push('/products')}
          className="font-[inherit] text-[10px] tracking-[0.2em] fg-dark bg-amber border-0 px-[18px] py-2.5 cursor-pointer uppercase"
        >
          ← Back to Products
        </button>
      </div>
    )
  }

  return (
    <div className="px-8 pt-8">
      {/* Header */}
      <div className="pb-6 bdb mb-8">
        <p className="text-[9px] tracking-[0.28em] fg-muted mb-2 uppercase">Products / New</p>
        <h1 className="text-[20px] font-semibold fg-t1 m-0 tracking-[-0.02em]">Add Product</h1>
        <p className="text-[11px] fg-t2 mt-2">
          Registers a product and generates an Ed25519 keypair. Embed the public key in your binary.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-[440px]">
        <Field label="Product Name" required>
          <input type="text" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="MyApp" className={inputCls} />
        </Field>

        <Field label="Slug" hint="used in license payload">
          <input type="text" required pattern="[a-z0-9-]+" value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="myapp" className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-5 mb-7">
          <div>
            <label className={lblCls}>Key ID</label>
            <input type="text" value={form.keyId} onChange={e => set('keyId', e.target.value)} placeholder="v1" className={inputCls} />
          </div>
          <div>
            <label className={lblCls}>Issuer Name <span className="opacity-60">(optional)</span></label>
            <input type="text" value={form.issuerName} onChange={e => set('issuerName', e.target.value)} placeholder="keyforge" className={inputCls} />
          </div>
        </div>

        {error && (
          <div className="mb-5 px-3 py-2 border border-[rgba(240,96,96,0.25)] text-[11px] fg-red bg-[rgba(240,96,96,0.05)]">
            {error}
          </div>
        )}

        <div className="flex gap-4 items-center pt-2">
          <button type="submit" disabled={loading} className={primBtnCls}>
            {loading ? 'Generating Keypair…' : 'Generate Keypair & Create →'}
          </button>
          <button type="button" onClick={() => router.back()} className={cancelBtnCls}>Cancel</button>
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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] tracking-[0.2em] fg-muted uppercase mb-1">{label}</div>
      <code className="text-xs fg-t2">{value}</code>
    </div>
  )
}
