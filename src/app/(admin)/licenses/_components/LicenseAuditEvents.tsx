import type { AuditEvent } from '../_lib/types'
import { fmtTs, EVENT_COLOR } from '../_lib/format'
import Section from './Section'

export default function LicenseAuditEvents({ events }: { events: AuditEvent[] }) {
  return (
    <Section title="Recent Events">
      {events.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--tm)' }}>No events yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {events.map(e => (
            <div key={e.id} style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              padding: '7px 0',
              borderBottom: '1px solid var(--bs)',
              fontSize: 11,
            }}>
              <span style={{
                color: EVENT_COLOR[e.type] ?? 'var(--t2)',
                letterSpacing: '0.1em',
                minWidth: 90,
                textTransform: 'uppercase',
                fontSize: 9,
              }}>
                {e.type.replace('_', ' ')}
              </span>
              <span style={{ color: 'var(--tm)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {fmtTs(e.createdAt)}
              </span>
              <span style={{ color: 'var(--tm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>
                {JSON.stringify(e.payload)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
