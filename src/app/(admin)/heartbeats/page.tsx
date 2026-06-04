import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function staleness(lastSeenAt: Date) {
  const age = Date.now() - new Date(lastSeenAt).getTime()
  if (age < 60 * 60 * 1000)       return { label: 'LIVE',  color: 'var(--green)',  dot: 'pulse' }
  if (age < 24 * 60 * 60 * 1000)  return { label: 'TODAY', color: 'var(--blue)',   dot: 'solid' }
  if (age < 7 * 24 * 60 * 60 * 1000) return { label: 'STALE', color: 'var(--orange)', dot: 'solid' }
  return                                    { label: 'OLD',   color: 'var(--red)',    dot: 'solid' }
}

function fmtTs(d: Date) {
  return new Date(d).toISOString().replace('T', ' ').slice(0, 19)
}

export default async function HeartbeatsPage() {
  if (!(await isAuthenticated())) redirect('/login')

  const products = await db.product.findMany({
    orderBy: { name: 'asc' },
    include: {
      licenses: {
        include: {
          instances: { orderBy: { lastSeenAt: 'desc' } },
          customer: { select: { id: true, name: true } },
        },
        where: { instances: { some: {} } },
      },
    },
  })

  const totalInstances = products.reduce(
    (sum, p) => sum + p.licenses.reduce((s, l) => s + l.instances.length, 0),
    0,
  )

  const liveCount = products.reduce((sum, p) =>
    sum + p.licenses.reduce((s, l) =>
      s + l.instances.filter(i => Date.now() - new Date(i.lastSeenAt).getTime() < 60 * 60 * 1000).length, 0), 0)

  return (
    <>
      <style>{`
        .hb-row:hover { background: var(--s2) !important; }
        .hb-link:hover { color: var(--amber) !important; }
        @keyframes pulse-dot {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.3; }
        }
      `}</style>

      <div style={{ padding: '32px 32px 0' }}>
        {/* Header */}
        <div style={{ paddingBottom: 24, borderBottom: '1px solid var(--bs)' }}>
          <p style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--tm)', marginBottom: 8, textTransform: 'uppercase' }}>
            License Portal
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--t1)', margin: 0, letterSpacing: '-0.02em' }}>
            Heartbeats
          </h1>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 32, padding: '18px 0', borderBottom: '1px solid var(--bs)' }}>
          <Stat label="Total Instances" value={totalInstances} />
          <Stat label="Live (last 1h)" value={liveCount} color="var(--green)" />
          <Stat label="Products" value={products.length} />
        </div>
      </div>

      {/* Tables per product */}
      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {totalInstances === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--tm)', letterSpacing: '0.15em', padding: '24px 0' }}>
            No heartbeats received yet.
          </div>
        ) : (
          products.map((product) => {
            const instances = product.licenses
              .flatMap(l => l.instances.map(i => ({ ...i, license: l })))
              .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
            if (instances.length === 0) return null

            return (
              <div key={product.id} style={{ border: '1px solid var(--bs)' }}>
                {/* Product header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--bs)',
                  background: 'var(--s1)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{product.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--tm)' }}>{product.slug}</span>
                  </div>
                  <span style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--tm)', textTransform: 'uppercase' }}>
                    {instances.length} instance{instances.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Column headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 260px 130px 80px 70px 1fr 1fr',
                  padding: '6px 16px',
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  color: 'var(--tm)',
                  borderBottom: '1px solid var(--bs)',
                  textTransform: 'uppercase',
                }}>
                  <span />
                  <span>Instance UUID</span>
                  <span>Customer</span>
                  <span>Version</span>
                  <span>Seq</span>
                  <span>Last Seen (UTC)</span>
                  <span>First Seen (UTC)</span>
                </div>

                {/* Rows */}
                {instances.map((inst) => {
                  const s = staleness(inst.lastSeenAt)
                  return (
                    <div
                      key={inst.id}
                      className="hb-row"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 260px 130px 80px 70px 1fr 1fr',
                        padding: '9px 16px',
                        borderBottom: '1px solid var(--bs)',
                        alignItems: 'center',
                        transition: 'background 0.1s',
                      }}
                    >
                      {/* Status dot */}
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: s.color,
                          display: 'inline-block',
                          animation: s.dot === 'pulse' ? 'pulse-dot 1.5s ease-in-out infinite' : 'none',
                        }} />
                      </div>

                      {/* UUID */}
                      <span style={{ fontSize: 10, color: 'var(--t2)', letterSpacing: '0.02em' }}>
                        {inst.instanceUuid}
                      </span>

                      {/* Customer */}
                      <Link
                        href={`/licenses/${inst.license.id}`}
                        className="hb-link"
                        style={{ fontSize: 11, color: 'var(--t2)', textDecoration: 'none', transition: 'color 0.1s' }}
                      >
                        {inst.license.customer.name}
                      </Link>

                      {/* Version */}
                      <span style={{ fontSize: 10, color: 'var(--tm)' }}>
                        {inst.lastVersion ? `v${inst.lastVersion}` : '—'}
                      </span>

                      {/* Seq */}
                      <span style={{ fontSize: 10, color: 'var(--tm)' }}>
                        {inst.latestSequence.toString()}
                      </span>

                      {/* Last seen */}
                      <span style={{ fontSize: 10, color: s.color }}>
                        {fmtTs(inst.lastSeenAt)}
                      </span>

                      {/* First seen */}
                      <span style={{ fontSize: 10, color: 'var(--tm)' }}>
                        {fmtTs(inst.firstSeenAt)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

function Stat({ label, value, color = 'var(--t2)' }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color, letterSpacing: '-0.03em' }}>
        {value}
      </div>
    </div>
  )
}
