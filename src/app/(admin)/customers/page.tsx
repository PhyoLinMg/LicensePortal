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
      <div className="px-8 pt-8">
        {/* Header */}
        <div className="flex items-end justify-between pb-6 bdb">
          <div>
            <p className="text-[9px] tracking-[0.28em] fg-muted mb-2 uppercase">Keyforge</p>
            <h1 className="text-[20px] font-semibold fg-t1 m-0 tracking-[-0.02em]">Customers</h1>
          </div>
          <Link
            href="/customers/new"
            className="text-[10px] tracking-[0.2em] fg-dark bg-amber px-[18px] py-[9px] no-underline uppercase font-semibold"
          >
            Add Customer →
          </Link>
        </div>

        {/* Count */}
        <div className="py-3.5 bdb">
          <span className="text-[9px] tracking-[0.2em] fg-muted uppercase">
            {customers.length} customer{customers.length !== 1 ? 's' : ''} registered
          </span>
        </div>
      </div>

      {/* List */}
      <div className="py-4">
        {customers.length === 0 ? (
          <div className="px-8 py-12 text-[11px] fg-muted tracking-[0.15em]">No customers yet.</div>
        ) : (
          customers.map((c) => (
            <div
              key={c.id}
              className="cust-row flex items-center justify-between px-8 py-3.5 bdb bdl-none transition-[background] duration-100 slide-in"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2.5 mb-1">
                  <span className="text-[13px] font-medium fg-t1">{c.name}</span>
                  <span className="text-[9px] tracking-[0.15em] fg-muted bd px-[5px] py-px">
                    {c._count.licenses} LIC
                  </span>
                </div>
                <div className="flex gap-4 text-[10px] fg-muted">
                  <span>{c.email ?? '—'}</span>
                  {c.notes && (
                    <span className="fg-muted truncate max-w-[300px]">{c.notes}</span>
                  )}
                </div>
              </div>
              <Link
                href={`/licenses/new?customerId=${c.id}`}
                className="issue-link text-[10px] tracking-[0.15em] fg-t2 no-underline uppercase transition-colors duration-100 shrink-0"
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
