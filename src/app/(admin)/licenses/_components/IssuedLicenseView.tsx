'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { primBtnStyle } from '../_lib/styles'

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
    <>
      <style>{`
        .lic-btn:hover { background: var(--amber-d) !important; }
        .lic-btn-sec:hover { color: var(--t1) !important; }
      `}</style>
      <div>
        <div style={{
          padding: '12px 16px',
          border: '1px solid rgba(61,214,140,0.2)',
          background: 'rgba(61,214,140,0.04)',
          marginBottom: 28,
        }}>
          <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500, marginBottom: 4 }}>
            License issued & signed
          </div>
          <div style={{ fontSize: 10, color: 'var(--t2)' }}>
            Download the .lic file and deliver to customer. Keep the private key secure.
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 10 }}>
            .lic Contents
          </div>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bs)', padding: '14px 16px' }}>
            <textarea
              readOnly
              value={licenseText}
              rows={4}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                fontSize: 10,
                color: 'var(--t2)',
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.7,
                wordBreak: 'break-all',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={download} className="lic-btn" style={primBtnStyle}>
            Download .lic
          </button>
          <button
            onClick={copyLic}
            className="lic-btn-sec"
            style={{
              fontFamily: 'inherit',
              fontSize: 10,
              letterSpacing: '0.18em',
              color: copied ? 'var(--green)' : 'var(--t2)',
              background: 'none',
              border: '1px solid var(--b)',
              padding: '10px 16px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'color 0.12s',
            }}
          >
            {copied ? 'Copied ✓' : 'Copy Text'}
          </button>
          <button
            onClick={() => router.push(`/licenses/${licenseId}`)}
            className="lic-btn-sec"
            style={{
              fontFamily: 'inherit',
              fontSize: 10,
              letterSpacing: '0.18em',
              color: 'var(--t2)',
              background: 'none',
              border: '1px solid var(--b)',
              padding: '10px 16px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'color 0.12s',
            }}
          >
            View License
          </button>
          <button
            onClick={() => router.push('/licenses')}
            style={{
              fontFamily: 'inherit',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--tm)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            ← Back to Licenses
          </button>
        </div>
      </div>
    </>
  )
}
