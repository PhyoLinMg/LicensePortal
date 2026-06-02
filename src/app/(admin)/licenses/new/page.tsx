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
    <div className="p-8 max-w-2xl">
      <h1 className="text-lg font-semibold text-white mb-6">Issue license</h1>
      <IssueLicenseForm products={products} customers={customers} />
    </div>
  )
}
