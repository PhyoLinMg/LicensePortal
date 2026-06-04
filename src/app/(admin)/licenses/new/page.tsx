import { db } from '@/lib/db'
import { isAuthenticated } from '@/lib/auth'
import { redirect } from 'next/navigation'
import IssueLicenseForm from './IssueLicenseForm'

export default async function NewLicensePage() {
  if (!(await isAuthenticated())) redirect('/login')

  const [products, customers] = await Promise.all([
    db.product.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
    db.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  return (
    <div style={{ padding: '32px 32px 0' }}>
      {/* Header */}
      <div style={{ paddingBottom: 24, borderBottom: '1px solid var(--bs)', marginBottom: 32 }}>
        <p style={{ fontSize: 9, letterSpacing: '0.28em', color: 'var(--tm)', marginBottom: 8, textTransform: 'uppercase' }}>
          Licenses / Issue
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--t1)', margin: 0, letterSpacing: '-0.02em' }}>
          Issue License
        </h1>
        <p style={{ fontSize: 11, color: 'var(--t2)', marginTop: 8 }}>
          Signs a new license with the product&#39;s Ed25519 private key.
        </p>
      </div>

      <div style={{ maxWidth: 560 }}>
        <IssueLicenseForm products={products} customers={customers} />
      </div>
    </div>
  )
}
