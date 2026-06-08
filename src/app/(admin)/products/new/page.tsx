'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
      <>
        <style>{`
          .key-copy-btn:hover { color: var(--amber) !important; }
        `}</style>
        <div style={{ padding: '32px 32px' }}>
          <div style={{ paddingBottom: 24, borderBottom: '1px solid var(--bs)', marginBottom: 32 }}>
            <p style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--tm)', marginBottom: 8, textTransform: 'uppercase' }}>
              Products / New
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--t1)', margin: 0, letterSpacing: '-0.02em' }}>
              Keypair Generated
            </h1>
          </div>

          {/* Success notice */}
          <div style={{
            padding: '12px 16px',
            border: '1px solid rgba(61,214,140,0.2)',
            background: 'rgba(61,214,140,0.04)',
            marginBottom: 28,
            fontSize: 11,
            color: 'var(--green)',
            letterSpacing: '0.04em',
          }}>
            Product created — Ed25519 keypair generated. Private key encrypted at rest.
          </div>

          {/* Public key */}
          <div style={{ marginBottom: 28, maxWidth: 640 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 10 }}>
              Public Key — embed in product binary
            </div>
            <div style={{ fontSize: 9, color: 'var(--tm)', marginBottom: 10 }}>
              Copy into{' '}
              <code style={{ color: 'var(--t2)' }}>application.yml</code>
              {' '}under{' '}
              <code style={{ color: 'var(--t2)' }}>app.license.public-keys.{created.keyId}</code>
            </div>
            <div style={{
              background: 'var(--s1)',
              border: '1px solid var(--bs)',
              padding: '14px 16px',
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
            }}>
              <code style={{
                fontSize: 10,
                color: 'var(--t2)',
                flex: 1,
                wordBreak: 'break-all',
                lineHeight: 1.75,
              }}>
                {created.publicKeyB64}
              </code>
              <button
                onClick={() => copy(created.publicKeyB64)}
                className="key-copy-btn"
                style={{
                  fontFamily: 'inherit',
                  fontSize: 9,
                  letterSpacing: '0.2em',
                  color: copied ? 'var(--green)' : 'var(--t2)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                  transition: 'color 0.15s',
                }}
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Meta */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            maxWidth: 320,
            padding: '16px 0',
            borderTop: '1px solid var(--bs)',
            borderBottom: '1px solid var(--bs)',
            marginBottom: 28,
          }}>
            <MetaItem label="Slug" value={created.slug} />
            <MetaItem label="Key ID" value={created.keyId} />
          </div>

          <button
            onClick={() => router.push('/products')}
            style={{
              fontFamily: 'inherit',
              fontSize: 10,
              letterSpacing: '0.2em',
              color: '#07080d',
              background: 'var(--amber)',
              border: 'none',
              padding: '10px 18px',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            ← Back to Products
          </button>
        </div>
      </>
    )
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
        <div style={{ paddingBottom: 24, borderBottom: '1px solid var(--bs)', marginBottom: 32 }}>
          <p style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--tm)', marginBottom: 8, textTransform: 'uppercase' }}>
            Products / New
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--t1)', margin: 0, letterSpacing: '-0.02em' }}>
            Add Product
          </h1>
          <p style={{ fontSize: 11, color: 'var(--t2)', marginTop: 8 }}>
            Registers a product and generates an Ed25519 keypair. Embed the public key in your binary.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ maxWidth: 440 }}>
          <Field label="Product Name" required>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="MyApp"
              className="form-input"
              style={inputStyle}
            />
          </Field>

          <Field label="Slug" hint="used in license payload">
            <input
              type="text"
              required
              pattern="[a-z0-9-]+"
              value={form.slug}
              onChange={e => set('slug', e.target.value)}
              placeholder="myapp"
              className="form-input"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
            <div>
              <label style={labelStyle}>Key ID</label>
              <input
                type="text"
                value={form.keyId}
                onChange={e => set('keyId', e.target.value)}
                placeholder="v1"
                className="form-input"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Issuer Name <span style={{ opacity: 0.6 }}>(optional)</span></label>
              <input
                type="text"
                value={form.issuerName}
                onChange={e => set('issuerName', e.target.value)}
                placeholder="keyforge"
                className="form-input"
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div style={{
              marginBottom: 20,
              padding: '8px 12px',
              border: '1px solid rgba(240,96,96,0.25)',
              fontSize: 11,
              color: 'var(--red)',
              background: 'rgba(240,96,96,0.05)',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 8 }}>
            <button
              type="submit"
              disabled={loading}
              className="form-btn-primary"
              style={primaryBtnStyle}
            >
              {loading ? 'Generating Keypair…' : 'Generate Keypair & Create →'}
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 9,
  letterSpacing: '0.25em',
  color: 'var(--tm)',
  marginBottom: 10,
  textTransform: 'uppercase',
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
  label: string; hint?: string; required?: boolean; children: React.ReactNode
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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <code style={{ fontSize: 12, color: 'var(--t2)' }}>{value}</code>
    </div>
  )
}
