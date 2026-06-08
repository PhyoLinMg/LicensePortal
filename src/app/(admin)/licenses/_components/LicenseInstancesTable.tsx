import type { LicenseInstance } from '../_lib/types'
import { fmtTs, stalenessClass } from '../_lib/format'
import Section from './Section'

function stalenessOrDotClass(iso: string): { dot: string; text: string } {
  const cls = stalenessClass(iso)
  const bg = cls === 'fg-green' ? 'bg-green' : cls === 'fg-orange' ? 'bg-amber' : 'bg-red'
  return { dot: bg, text: cls }
}

export default function LicenseInstancesTable({ instances }: { instances: LicenseInstance[] }) {
  return (
    <Section title={`Instances (${instances.length})`}>
      {instances.length === 0 ? (
        <p className="text-[11px] fg-muted">No heartbeats received yet.</p>
      ) : (
        <div className="bd overflow-hidden">
          <div className="grid grid-cols-[20px_1fr_120px_80px_60px] px-3.5 py-1.5 text-[9px] tracking-[0.18em] fg-muted bdb bg-s1 uppercase">
            <span /><span>UUID</span><span>Last Seen (UTC)</span><span>Version</span><span>Seq</span>
          </div>
          {instances.map(inst => {
            const { dot, text } = stalenessOrDotClass(inst.lastSeenAt)
            return (
              <div key={inst.id} className="inst-row grid grid-cols-[20px_1fr_120px_80px_60px] px-3.5 py-[9px] bdb items-center transition-[background] duration-100">
                <span className={`w-[5px] h-[5px] rounded-full ${dot} inline-block`} />
                <span className="text-[10px] fg-t2">{inst.instanceUuid}</span>
                <span className={`text-[10px] ${text}`}>{fmtTs(inst.lastSeenAt)}</span>
                <span className="text-[10px] fg-muted">{inst.lastVersion ? `v${inst.lastVersion}` : '—'}</span>
                <span className="text-[10px] fg-muted">{inst.latestSequence}</span>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}
