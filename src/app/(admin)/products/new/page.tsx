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

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
    if (k === 'name' && !form.slug) {
      setForm((f) => ({ ...f, slug: v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }))
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

  function copy(text: string) {
    navigator.clipboard.writeText(text)
  }

  if (created) {
    return (
      <div className="p-8 max-w-2xl space-y-4">
        <div className="bg-green-900/20 border border-green-800 rounded-xl p-4">
          <p className="text-sm text-green-400 font-medium">Product created — keypair generated</p>
          <p className="text-xs text-gray-400 mt-1">
            The private key is encrypted and stored securely. Copy the public key below and embed it in your product binary.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">
              Public key (SubjectPublicKeyInfo DER, base64) — copy into your product&#39;s{' '}
              <code className="text-gray-300">application.yml</code> under{' '}
              <code className="text-gray-300">app.license.public-keys.{created.keyId}</code>:
            </p>
            <div className="bg-gray-800 rounded-lg px-3 py-2 flex items-start gap-2">
              <code className="text-xs text-gray-300 flex-1 break-all">{created.publicKeyB64}</code>
              <button
                onClick={() => copy(created.publicKeyB64)}
                className="text-xs text-indigo-400 hover:text-indigo-300 shrink-0"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-500">Slug</p>
              <code className="text-gray-300">{created.slug}</code>
            </div>
            <div>
              <p className="text-gray-500">Key ID</p>
              <code className="text-gray-300">{created.keyId}</code>
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push('/products')}
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Back to products
        </button>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-lg font-semibold text-white mb-6">Add product</h1>
      <p className="text-sm text-gray-400 mb-6">
        Adding a product generates an Ed25519 keypair. The private key is encrypted at rest. You&#39;ll embed the public key in your product binary.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Product name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Handoff"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Slug (used in license payload)</label>
          <input
            type="text"
            required
            pattern="[a-z0-9-]+"
            value={form.slug}
            onChange={(e) => set('slug', e.target.value)}
            placeholder="handoff"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Key ID</label>
            <input
              type="text"
              value={form.keyId}
              onChange={(e) => set('keyId', e.target.value)}
              placeholder="v1"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Issuer name (optional)</label>
            <input
              type="text"
              value={form.issuerName}
              onChange={(e) => set('issuerName', e.target.value)}
              placeholder="handoff-license-server"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Generating keypair…' : 'Generate keypair & create'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white text-sm px-4 py-2 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
