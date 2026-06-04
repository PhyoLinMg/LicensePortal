'use client'

import { useState } from 'react'
import type { License } from '../_lib/types'
import { primBtnStyle, secBtnStyle } from '../_lib/styles'
import LicenseStatusBadge from './LicenseStatusBadge'

type Props = Pick<License, 'id' | 'status' | 'tier' | 'licenseText' | 'customer' | 'product'>

export default function LicenseDetailHeader({ license }: { license: Props }) {
  const [copiedLic, setCopiedLic] = useState(false)

  async function download() {
    const blob = new Blob([license.licenseText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `license-${license.id.slice(0, 8)}.lic`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copyLic() {
    try { await navigator.clipboard.writeText(license.licenseText) } catch { /* ignore */ }
    setCopiedLic(true)
    setTimeout(() => setCopiedLic(false), 2000)
  }

  return (
    <>
      <style>{`
        .detail-btn:hover { background: var(--amber-d) !important; }
        .detail-btn-sec:hover { border-color: var(--b2) !important; color: var(--t1) !important; }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '1px solid var(--bs)', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--tm)', marginBottom: 8, textTransform: 'uppercase' }}>
            Licenses / Detail
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--t1)', margin: 0, letterSpacing: '-0.02em' }}>
              {license.customer.name}
            </h1>
            <span style={{ fontSize: 11, color: 'var(--t2)' }}>{license.product.name}</span>
            <span style={{ fontSize: 8, letterSpacing: '0.18em', color: 'var(--tm)', border: '1px solid var(--b)', padding: '1px 5px', textTransform: 'uppercase' }}>
              {license.tier}
            </span>
          </div>
          <LicenseStatusBadge status={license.status} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={copyLic} className="detail-btn-sec" style={secBtnStyle}>
            {copiedLic ? 'Copied ✓' : 'Copy .lic'}
          </button>
          <button onClick={download} className="detail-btn" style={primBtnStyle}>
            Download .lic
          </button>
        </div>
      </div>
    </>
  )
}
