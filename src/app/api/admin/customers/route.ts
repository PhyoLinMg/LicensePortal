import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdminAuth } from '@/lib/auth'
import { parsePagination, paginatedResponse } from '@/lib/pagination'

const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(254).optional(),
  notes: z.string().max(4000).optional(),
})

export async function GET(req: NextRequest) {
  const err = await requireAdminAuth(req)
  if (err) return err

  const pagination = parsePagination(req)
  const select = {
    id: true,
    name: true,
    email: true,
    notes: true,
    createdAt: true,
    _count: { select: { licenses: true } },
  }

  const [customers, total] = await db.$transaction([
    db.customer.findMany({ orderBy: { createdAt: 'desc' }, select, skip: pagination.skip, take: pagination.take }),
    db.customer.count(),
  ])

  return paginatedResponse(customers, total, pagination, req.url)
}

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(req)
  if (err) return err

  let body: unknown
  try { body = await req.json() } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = CreateCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'validation_error', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { name, email, notes } = parsed.data

  const customer = await db.customer.create({
    data: { name, email, notes },
    select: { id: true, name: true, email: true, notes: true, createdAt: true },
  })
  return Response.json(customer, { status: 201 })
}
