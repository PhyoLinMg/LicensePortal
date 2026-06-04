import Link from 'next/link'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function CustomersPage() {
  if (!(await isAuthenticated())) redirect('/login')

  const customers = await db.customer.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      notes: true,
      createdAt: true,
      _count: { select: { licenses: true } },
    },
  })

  return (
    <>
      <style>{`
        .cust-row:hover { background: var(--s2) !important; }
        .issue-link:hover { color: var(--amber) !important; }
      `}</style>
      <div style={{ padding: '32px 32px 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 24, borderBottom: '1px solid var(--bs)' }}>
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--tm)', marginBottom: 8, textTransform: 'uppercase' }}>
              License Portal
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--t1)', margin: 0, letterSpacing: '-0.02em' }}>
              Customers
            </h1>
          </div>
          <Link
            href="/customers/new"
            style={{
              fontSize: 10,
              letterSpacing: '0.2em',
              color: '#07080d',
              background: 'var(--amber)',
              padding: '9px 18px',
              textDecoration: 'none',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Add Customer →
          </Link>
        </div>

        {/* Count */}
        <div style={{ padding: '14px 0', borderBottom: '1px solid var(--bs)' }}>
          <span style={{ fontSize: 9, letterSpacing: '0.2em', color: 'var(--tm)', textTransform: 'uppercase' }}>
            {customers.length} customer{customers.length !== 1 ? 's' : ''} registered
          </span>
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '16px 0' }}>
        {customers.length === 0 ? (
          <div style={{ padding: '48px 32px', fontSize: 11, color: 'var(--tm)', letterSpacing: '0.15em' }}>
            No customers yet.
          </div>
        ) : (
          customers.map((c, i) => (
            <div
              key={c.id}
              className="cust-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 32px',
                borderBottom: '1px solid var(--bs)',
                borderLeft: '3px solid transparent',
                transition: 'background 0.1s',
                animation: `slideRight 0.2s ease ${i * 25}ms both`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>
                    {c.name}
                  </span>
                  <span style={{
                    fontSize: 9,
                    letterSpacing: '0.15em',
                    color: 'var(--tm)',
                    border: '1px solid var(--bs)',
                    padding: '1px 5px',
                  }}>
                    {c._count.licenses} LIC
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--tm)' }}>
                  <span>{c.email ?? '—'}</span>
                  {c.notes && (
                    <span style={{ color: 'var(--tm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                      {c.notes}
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={`/licenses/new?customerId=${c.id}`}
                className="issue-link"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.15em',
                  color: 'var(--t2)',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                  transition: 'color 0.1s',
                  flexShrink: 0,
                }}
              >
                Issue License →
              </Link>
            </div>
          ))
        )}
      </div>
    </>
  )
}
