'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { primBtnCls } from '../_lib/styles'
import clsx from 'clsx'

export default function IssuedLicenseView({ licenseText, licenseId }: { licenseText: string; licenseId: string }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  async function download() {
    const blob = new Blob([licenseText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `license-${licenseId.slice(0, 8)}.lic`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copyLic() {
    try { await navigator.clipboard.writeText(licenseText) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <div className="px-4 py-3 border border-[rgba(61,214,140,0.2)] bg-[rgba(61,214,140,0.04)] mb-7">
        <div className="text-[11px] fg-green font-medium mb-1">License issued & signed</div>
        <div className="text-[10px] fg-t2">Download the .lic file and deliver to customer. Keep the private key secure.</div>
      </div>

      <div className="mb-6">
        <div className="text-[9px] tracking-[0.22em] fg-muted uppercase mb-2.5">.lic Contents</div>
        <div className="bg-s1 bd px-4 py-3.5">
          <textarea
            readOnly
            value={licenseText}
            rows={4}
            className="w-full bg-transparent border-0 text-[10px] fg-t2 font-[inherit] resize-none outline-none leading-[1.7] break-all"
          />
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button onClick={download} className={primBtnCls}>Download .lic</button>
        <button
          onClick={copyLic}
          className={clsx(
            'lic-btn-sec font-[inherit] text-[10px] tracking-[0.18em] bg-none bd-b px-4 py-2.5 cursor-pointer uppercase transition-colors duration-[120ms]',
            copied ? 'fg-green' : 'fg-t2',
          )}
        >
          {copied ? 'Copied ✓' : 'Copy Text'}
        </button>
        <button
          onClick={() => router.push(`/licenses/${licenseId}`)}
          className="lic-btn-sec font-[inherit] text-[10px] tracking-[0.18em] fg-t2 bg-none bd-b px-4 py-2.5 cursor-pointer uppercase transition-colors duration-[120ms]"
        >
          View License
        </button>
        <button
          onClick={() => router.push('/licenses')}
          className="font-[inherit] text-[10px] tracking-[0.15em] fg-muted bg-none border-0 cursor-pointer uppercase"
        >
          ← Back to Licenses
        </button>
      </div>
    </div>
  )
}
