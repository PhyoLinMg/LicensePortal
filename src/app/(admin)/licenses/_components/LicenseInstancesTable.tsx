import type { LicenseInstance } from '../_lib/types'
import { fmtTs, staleness } from '../_lib/format'
import Section from './Section'

export default function LicenseInstancesTable({ instances }: { instances: LicenseInstance[] }) {
  return (
    <Section title={`Instances (${instances.length})`}>
      {instances.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--tm)' }}>No heartbeats received yet.</p>
      ) : (
        <>
          <style>{`.inst-row:hover { background: var(--s2) !important; }`}</style>
          <div style={{ border: '1px solid var(--bs)', overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '20px 1fr 120px 80px 60px',
              padding: '6px 14px',
              fontSize: 9,
              letterSpacing: '0.18em',
              color: 'var(--tm)',
              borderBottom: '1px solid var(--bs)',
              background: 'var(--s1)',
              textTransform: 'uppercase',
            }}>
              <span /><span>UUID</span><span>Last Seen (UTC)</span><span>Version</span><span>Seq</span>
            </div>
            {instances.map(inst => {
              const color = staleness(inst.lastSeenAt)
              return (
                <div key={inst.id} className="inst-row" style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr 120px 80px 60px',
                  padding: '9px 14px',
                  borderBottom: '1px solid var(--bs)',
                  alignItems: 'center',
                  transition: 'background 0.1s',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: 'var(--t2)' }}>{inst.instanceUuid}</span>
                  <span style={{ fontSize: 10, color }}>{fmtTs(inst.lastSeenAt)}</span>
                  <span style={{ fontSize: 10, color: 'var(--tm)' }}>{inst.lastVersion ? `v${inst.lastVersion}` : '—'}</span>
                  <span style={{ fontSize: 10, color: 'var(--tm)' }}>{inst.latestSequence}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Section>
  )
}
