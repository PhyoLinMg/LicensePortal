'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelBtnCls } from '../_lib/styles'
import Section from './Section'
import clsx from 'clsx'

export default function RevokeLicensePanel({ licenseId }: { licenseId: string }) {
  const router = useRouter()
  const [revokeReason, setRevokeReason] = useState('')
  const [revoking, setRevoking] = useState(false)
  const [show, setShow] = useState(false)

  async function revoke() {
    if (!revokeReason.trim()) return
    setRevoking(true)
    try {
      const res = await fetch(`/api/admin/licenses/${licenseId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revokeReason }),
      })
      if (res.ok) { router.refresh(); setShow(false) }
    } finally {
      setRevoking(false)
    }
  }

  const disabled = revoking || !revokeReason.trim()

  return (
    <Section title="Danger Zone">
      {!show ? (
        <button
          onClick={() => setShow(true)}
          className="font-[inherit] text-[10px] tracking-[0.18em] fg-red bg-none border border-[rgba(240,96,96,0.3)] px-4 py-[9px] cursor-pointer uppercase"
        >
          Revoke License
        </button>
      ) : (
        <div>
          <p className="text-[11px] fg-t2 mb-3.5">
            Revocation is immediate. Next heartbeat returns <code className="fg-red">revoked</code> — instance blocks mutations.
          </p>
          <input
            type="text"
            required
            value={revokeReason}
            onChange={e => setRevokeReason(e.target.value)}
            placeholder="Reason (e.g. non-payment)"
            className="rev-input w-full max-w-[380px] bg-transparent bdb-b py-1.5 pb-2 text-[13px] fg-t1 font-[inherit] mb-4 block"
          />
          <div className="flex gap-3">
            <button
              onClick={revoke}
              disabled={disabled}
              className={clsx(
                'font-[inherit] text-[10px] tracking-[0.18em] px-4 py-[9px] uppercase transition-[background,color] duration-100',
                disabled
                  ? 'fg-muted bg-transparent bd-b cursor-not-allowed'
                  : 'fg-dark bg-red border border-[var(--red)] cursor-pointer',
                revoking && 'cursor-wait',
              )}
            >
              {revoking ? 'Revoking…' : 'Confirm Revoke'}
            </button>
            <button onClick={() => setShow(false)} className={cancelBtnCls}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Section>
  )
}
