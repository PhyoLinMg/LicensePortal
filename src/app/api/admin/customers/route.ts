import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const err = await requireAdminAuth(req)
  if (err) return err

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
  return Response.json(customers)
}

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(req)
  if (err) return err

  const { name, email, notes } = await req.json()
  if (!name) return Response.json({ error: 'name required' }, { status: 400 })

  const customer = await db.customer.create({
    data: { name, email, notes },
    select: { id: true, name: true, email: true, notes: true, createdAt: true },
  })
  return Response.json(customer, { status: 201 })
}
