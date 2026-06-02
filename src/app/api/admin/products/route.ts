import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { generateProductKeypair } from '@/lib/crypto'
import { requireAdminAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const err = await requireAdminAuth(req)
  if (err) return err

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
  return Response.json(products)
}

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(req)
  if (err) return err

  const { name, slug, keyId = 'v1', issuerName } = await req.json()

  if (!name || !slug) {
    return Response.json({ error: 'name and slug required' }, { status: 400 })
  }

  const keypair = generateProductKeypair()

  const product = await db.product.create({
    data: {
      name,
      slug,
      keyId,
      publicKeyB64: keypair.publicKeyB64,
      privateKeyEnc: keypair.privateKeyEnc,
      issuerName: issuerName ?? `${slug}-license-server`,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      keyId: true,
      publicKeyB64: true,
      issuerName: true,
      createdAt: true,
    },
  })

  await db.auditEvent.create({
    data: { type: 'PRODUCT_CREATE', payload: { productId: product.id, name, slug } },
  })

  return Response.json(product, { status: 201 })
}
