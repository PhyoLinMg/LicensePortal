'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cancelBtnStyle } from '../_lib/styles'
import Section from './Section'

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
    <>
      <style>{`
        .rev-input { transition: border-color 0.15s; }
        .rev-input:focus { border-bottom-color: var(--red) !important; outline: none; }
        .rev-input::placeholder { color: var(--tm); }
      `}</style>
      <Section title="Danger Zone">
        {!show ? (
          <button
            onClick={() => setShow(true)}
            style={{
              fontFamily: 'inherit',
              fontSize: 10,
              letterSpacing: '0.18em',
              color: 'var(--red)',
              background: 'none',
              border: '1px solid rgba(240,96,96,0.3)',
              padding: '9px 16px',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            Revoke License
          </button>
        ) : (
          <div>
            <p style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 14 }}>
              Revocation is immediate. Next heartbeat returns <code style={{ color: 'var(--red)' }}>revoked</code> — instance blocks mutations.
            </p>
            <input
              type="text"
              required
              value={revokeReason}
              onChange={e => setRevokeReason(e.target.value)}
              placeholder="Reason (e.g. non-payment)"
              className="rev-input"
              style={{
                width: '100%',
                maxWidth: 380,
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--b)',
                padding: '6px 0 8px',
                fontSize: 13,
                color: 'var(--t1)',
                fontFamily: 'inherit',
                marginBottom: 16,
                display: 'block',
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={revoke}
                disabled={disabled}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  color: disabled ? 'var(--tm)' : '#07080d',
                  background: disabled ? 'transparent' : 'var(--red)',
                  border: `1px solid ${disabled ? 'var(--b)' : 'var(--red)'}`,
                  padding: '9px 16px',
                  cursor: revoking ? 'wait' : disabled ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                  transition: 'background 0.1s, color 0.1s',
                }}
              >
                {revoking ? 'Revoking…' : 'Confirm Revoke'}
              </button>
              <button onClick={() => setShow(false)} style={cancelBtnStyle}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>
    </>
  )
}
