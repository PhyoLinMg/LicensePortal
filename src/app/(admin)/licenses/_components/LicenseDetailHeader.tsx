'use client'

import { useState } from 'react'
import type { License } from '../_lib/types'
import { primBtnCls, secBtnCls } from '../_lib/styles'
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
    <div className="flex items-end justify-between pb-5 bdb mb-7">
      <div>
        <p className="text-[9px] tracking-[0.28em] fg-muted mb-2 uppercase">
          Licenses / Detail
        </p>
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-[20px] font-semibold fg-t1 m-0 tracking-[-0.02em]">
            {license.customer.name}
          </h1>
          <span className="text-[11px] fg-t2">{license.product.name}</span>
          <span className="text-[8px] tracking-[0.18em] fg-muted bd-b px-[5px] py-px uppercase">
            {license.tier}
          </span>
        </div>
        <LicenseStatusBadge status={license.status} />
      </div>
      <div className="flex gap-2.5">
        <button onClick={copyLic} className={secBtnCls}>
          {copiedLic ? 'Copied ✓' : 'Copy .lic'}
        </button>
        <button onClick={download} className={primBtnCls}>
          Download .lic
        </button>
      </div>
    </div>
  )
}
