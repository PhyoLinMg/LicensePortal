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
      <style>{`
        .key-block { background: var(--bs); }
        .key-block:hover { background: var(--s2) !important; }
      `}</style>
      <div style={{ padding: '32px 32px 0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 24, borderBottom: '1px solid var(--bs)' }}>
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--tm)', marginBottom: 8, textTransform: 'uppercase' }}>
              License Portal
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--t1)', margin: 0, letterSpacing: '-0.02em' }}>
              Products
            </h1>
          </div>
          <Link
            href="/products/new"
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
            Add Product →
          </Link>
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {products.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--tm)', letterSpacing: '0.15em', padding: '24px 0' }}>
            No products yet. Add one to start issuing licenses.
          </div>
        ) : (
          products.map((p, i) => (
            <div
              key={p.id}
              style={{
                border: '1px solid var(--bs)',
                padding: '18px 20px',
                animation: `slideRight 0.22s ease ${i * 30}ms both`,
              }}
            >
              {/* Product header */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>{p.name}</span>
                <span style={{ fontSize: 10, color: 'var(--t2)' }}>{p.slug}</span>
                <span style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--tm)', textTransform: 'uppercase' }}>
                  key_id={p.keyId}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--tm)' }}>
                  {p._count.licenses} license{p._count.licenses !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Public key */}
              <div>
                <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Public Key — SubjectPublicKeyInfo DER / Base64
                </div>
                <div
                  className="key-block"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '10px 14px',
                    transition: 'background 0.1s',
                  }}
                >
                  <code style={{
                    fontSize: 10,
                    color: 'var(--t2)',
                    flex: 1,
                    wordBreak: 'break-all',
                    lineHeight: 1.7,
                  }}>
                    {p.publicKeyB64}
                  </code>
                  <CopyButton text={p.publicKeyB64} />
                </div>
                <div style={{ fontSize: 9, color: 'var(--tm)', marginTop: 6 }}>
                  Embed in product binary under{' '}
                  <code style={{ color: 'var(--t2)' }}>app.license.public-keys.{p.keyId}</code>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
