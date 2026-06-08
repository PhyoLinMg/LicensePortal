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
    <div className="px-8 pt-8">
      {/* Header */}
      <div className="pb-6 bdb mb-8">
        <p className="text-[9px] tracking-[0.28em] fg-muted mb-2 uppercase">Licenses / Issue</p>
        <h1 className="text-[20px] font-semibold fg-t1 m-0 tracking-[-0.02em]">Issue License</h1>
        <p className="text-[11px] fg-t2 mt-2">Signs a new license with the product&#39;s Ed25519 private key.</p>
      </div>

      <div className="max-w-[560px]">
        <IssueLicenseForm products={products} customers={customers} />
      </div>
    </div>
  )
}
