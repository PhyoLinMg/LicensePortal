import { statusClass } from '../_lib/format'

function statusBgClass(s: string): string {
  if (s === 'active') return 'bg-green'
  if (s === 'revoked') return 'bg-red'
  return 'bg-amber'
}

export default function LicenseStatusBadge({ status }: { status: string }) {
  const textCls = statusClass(status)
  const bgCls = statusBgClass(status)
  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full ${bgCls} inline-block`} />
      <span className={`text-[9px] tracking-[0.2em] ${textCls} uppercase`}>
        {status}
      </span>
    </div>
  )
}
