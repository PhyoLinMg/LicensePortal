import Link from 'next/link'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function ProductsPage() {
  if (!(await isAuthenticated())) redirect('/login')

  const products = await db.product.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      keyId: true,
      publicKeyB64: true,
      issuerName: true,
      createdAt: true,
      _count: { select: { licenses: true } },
    },
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-white">Products</h1>
        <Link
          href="/products/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Add product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-gray-500 text-sm">No products yet. Add one to start issuing licenses.</p>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h2 className="text-sm font-medium text-white">{p.name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    slug: <code className="text-gray-400">{p.slug}</code> ·{' '}
                    key_id: <code className="text-gray-400">{p.keyId}</code> ·{' '}
                    {p._count.licenses} license{p._count.licenses !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Public key — embed this in your product binary (SubjectPublicKeyInfo DER, base64):
                </p>
                <div className="bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-2">
                  <code className="text-xs text-gray-300 flex-1 break-all">{p.publicKeyB64}</code>
                  <CopyButton text={p.publicKeyB64} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  // Client component needed for clipboard — inline in a server page via 'use client' trick
  // For now render as a simple span — full copy in NewProductForm pattern
  return (
    <span className="text-xs text-indigo-400 shrink-0 cursor-pointer select-none">
      copy
    </span>
  )
}
