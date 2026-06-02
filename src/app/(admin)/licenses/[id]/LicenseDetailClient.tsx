'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface License {
  id: string
  status: string
  tier: string
  features: string[]
  limits: Record<string, number>
  issuedAt: string
  expiresAt: string
  gracePeriodDays: number
  heartbeatUrl: string | null
  licenseText: string
  revokedAt: string | null
  revokeReason: string | null
  customer: { id: string; name: string; email: string | null }
  product: { id: string; name: string; slug: string; keyId: string }
  instances: Array<{
    id: string
    instanceUuid: string
    lastSeenAt: string
    firstSeenAt: string
    lastVersion: string | null
    lastUsage: Record<string, number> | null
    latestSequence: string
  }>
  auditEvents: Array<{
    id: string
    type: string
    payload: unknown
    createdAt: string
  }>
}

export default function LicenseDetailClient({ license }: { license: License }) {
  const router = useRouter()
  const [revokeReason, setRevokeReason] = useState('')
  const [revoking, setRevoking] = useState(false)
  const [showRevoke, setShowRevoke] = useState(false)

  function download() {
    const blob = new Blob([license.licenseText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `license-${license.id.slice(0, 8)}.lic`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function revoke() {
    if (!revokeReason.trim()) return
    setRevoking(true)
    try {
      const res = await fetch(`/api/admin/licenses/${license.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revokeReason }),
      })
      if (res.ok) {
        router.refresh()
        setShowRevoke(false)
      }
    } finally {
      setRevoking(false)
    }
  }

  const isActive = license.status === 'active'

  return (
    <div className="p-8 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">{license.customer.name}</h1>
          <p className="text-sm text-gray-400">
            {license.product.name} · {license.tier}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-md font-medium ${
            isActive ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
          }`}>
            {license.status}
          </span>
          <button
            onClick={download}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Download .lic
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 grid grid-cols-2 gap-4 text-sm">
        <Detail label="License ID" value={license.id} mono />
        <Detail label="Customer" value={`${license.customer.name}${license.customer.email ? ` <${license.customer.email}>` : ''}`} />
        <Detail label="Expires" value={new Date(license.expiresAt).toLocaleDateString()} />
        <Detail label="Grace period" value={`${license.gracePeriodDays} days`} />
        <Detail label="Key ID" value={license.product.keyId} mono />
        <Detail label="Issued" value={new Date(license.issuedAt).toLocaleString()} />
        {license.heartbeatUrl && (
          <div className="col-span-2">
            <Detail label="Heartbeat URL" value={license.heartbeatUrl} mono />
          </div>
        )}
      </div>

      {/* Limits */}
      {Object.keys(license.limits).length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Limits</h2>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(license.limits).map(([k, v]) => (
              <div key={k} className="bg-gray-800 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400">{k.replace(/_/g, ' ')}</p>
                <p className="text-lg font-semibold text-white">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      {license.features.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {license.features.map((f) => (
            <span key={f} className="bg-indigo-900/40 text-indigo-300 text-xs px-2 py-1 rounded-md">
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Instances */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-3">
          Instances ({license.instances.length})
        </h2>
        {license.instances.length === 0 ? (
          <p className="text-xs text-gray-500">No heartbeats received yet.</p>
        ) : (
          <div className="space-y-2">
            {license.instances.map((inst) => (
              <div key={inst.id} className="bg-gray-800 rounded-lg px-3 py-2 text-xs">
                <p className="text-gray-300 font-mono">{inst.instanceUuid}</p>
                <p className="text-gray-500 mt-0.5">
                  Last seen {new Date(inst.lastSeenAt).toLocaleString()}
                  {inst.lastVersion ? ` · v${inst.lastVersion}` : ''}
                  {' · '}seq {inst.latestSequence}
                </p>
                {inst.lastUsage != null && (
                  <p className="text-gray-600 font-mono mt-0.5">
                    {JSON.stringify(inst.lastUsage)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit log */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Audit log</h2>
        <div className="space-y-1">
          {license.auditEvents.map((e) => (
            <div key={e.id} className="flex items-baseline gap-3 text-xs">
              <span className="text-gray-500 shrink-0">
                {new Date(e.createdAt).toLocaleString()}
              </span>
              <span className="text-gray-300 font-medium">{e.type}</span>
              <span className="text-gray-600 font-mono truncate">
                {JSON.stringify(e.payload)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Revoke */}
      {isActive && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Danger zone</h2>
          {!showRevoke ? (
            <button
              onClick={() => setShowRevoke(true)}
              className="bg-red-900/40 hover:bg-red-900/60 text-red-400 text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Revoke license
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Revocation is immediate. The next heartbeat will return <code className="text-red-400">revoked</code> and the instance will block mutations.
              </p>
              <input
                type="text"
                required
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Reason (e.g. non-payment)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              />
              <div className="flex gap-3">
                <button
                  onClick={revoke}
                  disabled={revoking || !revokeReason.trim()}
                  className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  {revoking ? 'Revoking…' : 'Confirm revoke'}
                </button>
                <button
                  onClick={() => setShowRevoke(false)}
                  className="text-gray-400 hover:text-white text-sm px-4 py-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {license.status === 'revoked' && license.revokedAt && (
        <div className="bg-red-900/10 border border-red-800 rounded-xl p-4 text-sm">
          <p className="text-red-400 font-medium">Revoked {new Date(license.revokedAt).toLocaleString()}</p>
          {license.revokeReason && (
            <p className="text-gray-400 mt-1">Reason: {license.revokeReason}</p>
          )}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm text-white truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  )
}
