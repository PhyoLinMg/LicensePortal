import Link from 'next/link'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { redirect } from 'next/navigation'

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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-white">Licenses</h1>
        <Link
          href="/licenses/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Issue license
        </Link>
      </div>

      {licenses.length === 0 ? (
        <p className="text-gray-500 text-sm">No licenses issued yet.</p>
      ) : (
        <div className="space-y-2">
          {licenses.map((l) => (
            <Link
              key={l.id}
              href={`/licenses/${l.id}`}
              className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl px-5 py-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{l.customer.name}</span>
                    <span className="text-xs text-gray-500">·</span>
                    <span className="text-xs text-gray-400">{l.product.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      l.tier === 'enterprise' ? 'bg-violet-900 text-violet-300' :
                      l.tier === 'pro' ? 'bg-blue-900 text-blue-300' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {l.tier}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Expires {new Date(l.expiresAt).toLocaleDateString()} ·{' '}
                    {l._count.instances} instance{l._count.instances !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                  l.status === 'active' ? 'bg-green-900/50 text-green-400' :
                  l.status === 'revoked' ? 'bg-red-900/50 text-red-400' :
                  'bg-gray-800 text-gray-400'
                }`}>
                  {l.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
