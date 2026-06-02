import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminAuth } from '@/lib/auth'
import { issueLicense } from '@/lib/license'
import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const err = await requireAdminAuth(req)
  if (err) return err

  const licenses = await db.license.findMany({
    orderBy: { issuedAt: 'desc' },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, name: true, slug: true } },
      _count: { select: { instances: true } },
    },
  })

  // strip licenseText from list view (can be large)
  return Response.json(
    licenses.map(({ licenseText: _, payloadJson: __, ...l }) => l)
  )
}

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(req)
  if (err) return err

  const body = await req.json()
  const {
    productId,
    customerId,
    tier,
    features = [],
    limits = {},
    notBefore,
    expiresAt,
    gracePeriodDays = 21,
    heartbeatUrl,
  } = body

  if (!productId || !customerId || !tier || !expiresAt) {
    return Response.json(
      { error: 'productId, customerId, tier, expiresAt required' },
      { status: 400 }
    )
  }

  const [product, customer] = await Promise.all([
    db.product.findUnique({ where: { id: productId } }),
    db.customer.findUnique({ where: { id: customerId } }),
  ])

  if (!product) return Response.json({ error: 'product not found' }, { status: 404 })
  if (!customer) return Response.json({ error: 'customer not found' }, { status: 404 })

  const licenseId = randomUUID()
  const nbDate = notBefore ? new Date(notBefore) : new Date()
  const expDate = new Date(expiresAt)

  const defaultHeartbeatUrl =
    heartbeatUrl ??
    `${process.env.NEXT_PUBLIC_BASE_URL ?? 'https://license.example.com'}/api/v1/heartbeat`

  const { payload, text } = issueLicense({
    licenseId,
    productSlug: product.slug,
    productIssuer: product.issuerName,
    keyId: product.keyId,
    customerId: customer.id,
    customerName: customer.name,
    tier,
    features,
    limits,
    notBefore: nbDate,
    expiresAt: expDate,
    gracePeriodDays,
    heartbeatUrl: defaultHeartbeatUrl,
    privateKeyEnc: product.privateKeyEnc,
  })

  const license = await db.license.create({
    data: {
      id: licenseId,
      customerId: customer.id,
      productId: product.id,
      keyId: product.keyId,
      tier,
      features,
      limits,
      notBefore: nbDate,
      expiresAt: expDate,
      gracePeriodDays,
      heartbeatUrl: defaultHeartbeatUrl,
      status: 'active',
      payloadJson: payload as unknown as Prisma.InputJsonValue,
      signature: text.split('.')[1],
      licenseText: text,
    },
    include: {
      customer: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, slug: true } },
    },
  })

  await db.auditEvent.create({
    data: {
      licenseId: license.id,
      type: 'ISSUE',
      payload: {
        customerId: customer.id,
        customerName: customer.name,
        productId: product.id,
        tier,
        expiresAt: expDate.toISOString(),
      },
    },
  })

  return Response.json(
    { ...license, licenseText: text, payloadJson: undefined },
    { status: 201 }
  )
}
