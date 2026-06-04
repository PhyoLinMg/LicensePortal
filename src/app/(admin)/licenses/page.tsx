import Link from 'next/link'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { statusColor, tierLabel } from './_lib/format'

export default async function LicensesPage() {
  if (!(await isAuthenticated())) redirect('/login')

  const licenses = await db.license.findMany({
    orderBy: { issuedAt: 'desc' },
    include: {
      customer: { select: { name: true } },
      product: { select: { name: true, slug: true } },
      _count: { select: { instances: true } },
    },
  })

  const active = licenses.filter(l => l.status === 'active').length
  const revoked = licenses.filter(l => l.status === 'revoked').length

  return (
    <>
      <style>{`
        .lic-row:hover { background: var(--s2) !important; }
      `}</style>
      <div style={{ padding: '32px 32px 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 24, borderBottom: '1px solid var(--bs)' }}>
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--tm)', marginBottom: 8, textTransform: 'uppercase' }}>
              License Portal
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--t1)', margin: 0, letterSpacing: '-0.02em' }}>
              Licenses
            </h1>
          </div>
          <Link
            href="/licenses/new"
            style={{
              fontSize: 10,
              letterSpacing: '0.2em',
              color: '#07080d',
              background: 'var(--amber)',
              padding: '9px 18px',
              textDecoration: 'none',
              textTransform: 'uppercase',
              fontWeight: 600,
              transition: 'background 0.1s',
            }}
          >
            Issue License →
          </Link>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 32, padding: '18px 0', borderBottom: '1px solid var(--bs)' }}>
          <Stat label="Total" value={licenses.length} />
          <Stat label="Active" value={active} color="var(--green)" />
          <Stat label="Revoked" value={revoked} color="var(--red)" />
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '16px 0' }}>
        {licenses.length === 0 ? (
          <div style={{ padding: '48px 32px', fontSize: 11, color: 'var(--tm)', letterSpacing: '0.15em' }}>
            No licenses issued yet.
          </div>
        ) : (
          licenses.map((l) => (
            <Link
              key={l.id}
              href={`/licenses/${l.id}`}
              className="lic-row"
              style={{
                display: 'block',
                padding: '14px 32px',
                borderLeft: `3px solid ${statusColor(l.status)}`,
                borderBottom: '1px solid var(--bs)',
                textDecoration: 'none',
                transition: 'background 0.1s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>
                      {l.customer.name}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--tm)' }}>·</span>
                    <span style={{ fontSize: 11, color: 'var(--t2)' }}>{l.product.name}</span>
                    <span style={{
                      fontSize: 8,
                      letterSpacing: '0.18em',
                      color: 'var(--tm)',
                      border: '1px solid var(--b)',
                      padding: '1px 5px',
                      textTransform: 'uppercase',
                    }}>
                      {tierLabel(l.tier)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--tm)' }}>
                    <span>Expires {new Date(l.expiresAt).toLocaleDateString('en-CA')}</span>
                    <span>{l._count.instances} instance{l._count.instances !== 1 ? 's' : ''}</span>
                    <span style={{ color: 'var(--tm)', fontFamily: 'inherit' }}>
                      {l.id.slice(0, 8)}…
                    </span>
                  </div>
                </div>
                <div style={{
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  color: statusColor(l.status),
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}>
                  {l.status}
                </div>
              </div>
            </Link>
          ))
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
