import { fmtTs } from '../_lib/format'

export default function RevokedBanner({ revokedAt, revokeReason }: { revokedAt: string; revokeReason: string | null }) {
  return (
    <div style={{
      padding: '10px 14px',
      border: '1px solid rgba(240,96,96,0.25)',
      background: 'rgba(240,96,96,0.04)',
      marginBottom: 24,
      fontSize: 11,
      color: 'var(--red)',
    }}>
      Revoked {fmtTs(revokedAt)}
      {revokeReason && ` — ${revokeReason}`}
    </div>
  )
}
