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
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-white">Customers</h1>
        <Link
          href="/customers/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Add customer
        </Link>
      </div>

      {customers.length === 0 ? (
        <p className="text-gray-500 text-sm">No customers yet.</p>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{c.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.email ?? 'no email'} · {c._count.licenses} license{c._count.licenses !== 1 ? 's' : ''}
                  </p>
                  {c.notes && <p className="text-xs text-gray-600 mt-1">{c.notes}</p>}
                </div>
                <Link
                  href={`/licenses/new?customerId=${c.id}`}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Issue license →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
