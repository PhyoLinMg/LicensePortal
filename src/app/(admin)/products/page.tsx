import Link from 'next/link'
import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CopyButton } from './CopyButton'

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
    <>
      <div className="px-8 pt-8">
        {/* Header */}
        <div className="flex items-end justify-between pb-6 bdb">
          <div>
            <p className="text-[9px] tracking-[0.28em] fg-muted mb-2 uppercase">Keyforge</p>
            <h1 className="text-[20px] font-semibold fg-t1 m-0 tracking-[-0.02em]">Products</h1>
          </div>
          <Link
            href="/products/new"
            className="text-[10px] tracking-[0.2em] fg-dark bg-amber px-[18px] py-[9px] no-underline uppercase font-semibold"
          >
            Add Product →
          </Link>
        </div>
      </div>

      {/* List */}
      <div className="px-8 py-6 flex flex-col gap-4">
        {products.length === 0 ? (
          <div className="text-[11px] fg-muted tracking-[0.15em] py-6">
            No products yet. Add one to start issuing licenses.
          </div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="bd px-5 py-[18px] slide-in">
              {/* Product header */}
              <div className="flex items-baseline gap-3 mb-3.5">
                <span className="text-sm font-medium fg-t1">{p.name}</span>
                <span className="text-[10px] fg-t2">{p.slug}</span>
                <span className="text-[9px] tracking-[0.15em] fg-muted uppercase">key_id={p.keyId}</span>
                <span className="ml-auto text-[9px] fg-muted">
                  {p._count.licenses} license{p._count.licenses !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Public key */}
              <div>
                <div className="text-[9px] tracking-[0.2em] fg-muted uppercase mb-2">
                  Public Key — SubjectPublicKeyInfo DER / Base64
                </div>
                <div className="key-block flex items-start gap-3 px-3.5 py-2.5">
                  <code className="text-[10px] fg-t2 flex-1 break-all leading-[1.7]">
                    {p.publicKeyB64}
                  </code>
                  <CopyButton text={p.publicKeyB64} />
                </div>
                <div className="text-[9px] fg-muted mt-1.5">
                  Embed in product binary under{' '}
                  <code className="fg-t2">app.license.public-keys.{p.keyId}</code>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
