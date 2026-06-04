import { isAuthenticated } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import AuditLogTable, { type AuditRow } from './AuditLogTable'

export const dynamic = 'force-dynamic'

export default async function AuditPage() {
  if (!(await isAuthenticated())) redirect('/login')

  const events = await db.auditEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: {
      license: {
        include: {
          customer: { select: { name: true } },
          product: { select: { name: true } },
        },
      },
    },
  })

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recent = events.filter(e => e.createdAt.getTime() > cutoff)

  const stats = {
    total: recent.length,
    issued: recent.filter(e => e.type === 'ISSUE').length,
    revoked: recent.filter(e => e.type === 'REVOKE').length,
    failures: recent.filter(e => e.type === 'HEARTBEAT_FAIL').length,
  }

  const latestAt = events[0]?.createdAt.toISOString() ?? null
  const isLive = latestAt !== null && Date.now() - new Date(latestAt).getTime() < 5 * 60 * 1000

  const rows: AuditRow[] = events.map(e => ({
    id: e.id,
    type: e.type,
    payload: e.payload,
    createdAt: e.createdAt.toISOString(),
    licenseId: e.licenseId,
    customerName: e.license?.customer.name ?? null,
    productName: e.license?.product.name ?? null,
  }))

  return (
    <>
      <div style={{ padding: '32px 32px 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 24, borderBottom: '1px solid var(--bs)' }}>
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--tm)', marginBottom: 8, textTransform: 'uppercase' }}>
              License Portal
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--t1)', margin: 0, letterSpacing: '-0.02em' }}>
              Audit Log
            </h1>
            <p style={{ fontSize: 11, color: 'var(--t2)', marginTop: 6 }}>
              Immutable record — last 500 events shown
            </p>
          </div>

          {isLive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, letterSpacing: '0.22em', color: 'var(--tm)' }}>
              <span className="relative flex" style={{ width: 8, height: 8 }}>
                <span
                  className="animate-ping absolute inline-flex rounded-full"
                  style={{ width: '100%', height: '100%', background: 'var(--green)', opacity: 0.5 }}
                />
                <span
                  className="relative inline-flex rounded-full"
                  style={{ width: 8, height: 8, background: 'var(--green)' }}
                />
              </span>
              LIVE
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 32, padding: '18px 0', borderBottom: '1px solid var(--bs)' }}>
          <Stat label="30-Day Events" value={stats.total} />
          <Stat label="Issued" value={stats.issued} color="var(--green)" />
          <Stat label="Revoked" value={stats.revoked} color="var(--red)" />
          <Stat label="HB Failures" value={stats.failures} color="var(--orange)" />
        </div>
      </div>

      <AuditLogTable events={rows} />
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
