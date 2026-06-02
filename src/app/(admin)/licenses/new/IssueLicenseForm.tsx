'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    limits: '{}',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [issued, setIssued] = useState<{ licenseText: string; id: string } | null>(null)

  function set(key: string, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    let limits: Record<string, number>
    try {
      limits = JSON.parse(form.limits)
    } catch {
      setError('Limits must be valid JSON object')
      setLoading(false)
      return
    }

    const features = form.features
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)

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
      if (!res.ok) {
        setError(data.error ?? 'Failed to issue license')
      } else {
        setIssued({ licenseText: data.licenseText, id: data.id })
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  function download() {
    if (!issued) return
    const blob = new Blob([issued.licenseText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `license-${issued.id.slice(0, 8)}.lic`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (issued) {
    return (
      <div className="space-y-4">
        <div className="bg-green-900/20 border border-green-800 rounded-xl p-4">
          <p className="text-sm text-green-400 font-medium mb-1">License issued successfully</p>
          <p className="text-xs text-gray-400">Download the .lic file and deliver it to the customer.</p>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">.lic file contents</label>
          <textarea
            readOnly
            value={issued.licenseText}
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={download}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Download .lic
          </button>
          <button
            onClick={() => router.push(`/licenses/${issued.id}`)}
            className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            View license
          </button>
          <button
            onClick={() => router.push('/licenses')}
            className="text-gray-400 hover:text-white text-sm px-4 py-2 transition-colors"
          >
            Back to list
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Product</label>
          <select
            value={form.productId}
            onChange={(e) => set('productId', e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Customer</label>
          <select
            value={form.customerId}
            onChange={(e) => set('customerId', e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Tier</label>
          <select
            value={form.tier}
            onChange={(e) => set('tier', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Expires at</label>
          <input
            type="date"
            required
            value={form.expiresAt}
            onChange={(e) => set('expiresAt', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Limits <span className="text-gray-600">(JSON key/value — product-specific)</span>
        </label>
        <textarea
          value={form.limits}
          onChange={(e) => set('limits', e.target.value)}
          rows={4}
          placeholder={'{\n  "max_clients": 50,\n  "max_msp_users": 10\n}'}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Features <span className="text-gray-600">(comma-separated, optional)</span>
        </label>
        <input
          type="text"
          value={form.features}
          onChange={(e) => set('features', e.target.value)}
          placeholder="it_glue, white_label"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Grace period (days)</label>
          <input
            type="number"
            min={0}
            max={90}
            value={form.gracePeriodDays}
            onChange={(e) => set('gracePeriodDays', parseInt(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Heartbeat URL <span className="text-gray-600">(leave blank for default)</span>
          </label>
          <input
            type="url"
            value={form.heartbeatUrl}
            onChange={(e) => set('heartbeatUrl', e.target.value)}
            placeholder="https://license.example.com/api/v1/heartbeat"
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
          disabled={loading || products.length === 0 || customers.length === 0}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Signing…' : 'Issue & sign license'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white text-sm px-4 py-2 transition-colors"
        >
          Cancel
        </button>
      </div>

      {(products.length === 0 || customers.length === 0) && (
        <p className="text-xs text-amber-400">
          {products.length === 0 ? 'Add a product first. ' : ''}
          {customers.length === 0 ? 'Add a customer first.' : ''}
        </p>
      )}
    </form>
  )
}
