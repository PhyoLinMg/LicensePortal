import type { AuditEvent } from '../_lib/types'
import { fmtTs, EVENT_CLASS } from '../_lib/format'
import Section from './Section'

export default function LicenseAuditEvents({ events }: { events: AuditEvent[] }) {
  return (
    <Section title="Recent Events">
      {events.length === 0 ? (
        <p className="text-[11px] fg-muted">No events yet.</p>
      ) : (
        <div className="flex flex-col">
          {events.map(e => (
            <div key={e.id} className="flex items-baseline gap-3.5 py-[7px] bdb text-[11px]">
              <span className={`${EVENT_CLASS[e.type] ?? 'fg-t2'} tracking-[0.1em] min-w-[90px] uppercase text-[9px]`}>
                {e.type.replace('_', ' ')}
              </span>
              <span className="fg-muted shrink-0 [font-variant-numeric:tabular-nums]">
                {fmtTs(e.createdAt)}
              </span>
              <span className="fg-muted truncate text-[10px]">
                {JSON.stringify(e.payload)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
