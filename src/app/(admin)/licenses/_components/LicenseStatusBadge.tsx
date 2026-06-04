import { statusColor } from '../_lib/format'

export default function LicenseStatusBadge({ status }: { status: string }) {
  const color = statusColor(status)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 9, letterSpacing: '0.2em', color, textTransform: 'uppercase' }}>
        {status}
      </span>
    </div>
  )
}
