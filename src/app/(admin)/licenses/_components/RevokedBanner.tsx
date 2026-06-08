import { fmtTs } from '../_lib/format'

export default function RevokedBanner({ revokedAt, revokeReason }: { revokedAt: string; revokeReason: string | null }) {
  return (
    <div className="px-3.5 py-2.5 border border-[rgba(240,96,96,0.25)] bg-[rgba(240,96,96,0.04)] mb-6 text-[11px] fg-red">
      Revoked {fmtTs(revokedAt)}
      {revokeReason && ` — ${revokeReason}`}
    </div>
  )
}
