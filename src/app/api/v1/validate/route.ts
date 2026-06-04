import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parseLicensePayload, verifyLicenseText } from '@/lib/crypto'
import { buildEnforcementInfo } from '@/lib/enforce'
import type { Prisma } from '@prisma/client'

// POST /api/v1/validate
// Validates a license token and returns the current enforcement state.
// No auth required — the license text itself is the credential.
// Called by Handoff on boot and periodically to poll enforcement state.
//
// Request:  { license_text: string }
// Response: { state, license_id, tier, features, limits, expires_at,
//             grace_period_days, heartbeat_url, new_license }
export async function POST(req: NextRequest) {
  let body: { license_text?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { license_text } = body
  if (!license_text) {
    return Response.json({ error: 'license_text required' }, { status: 400 })
  }

  let payload: Record<string, unknown>
  try {
    payload = parseLicensePayload(license_text)
  } catch {
    return Response.json({ state: 'INVALID', error: 'malformed_license' }, { status: 422 })
  }

  const productId = payload.product_id as string | undefined
  const licenseId = payload.license_id as string | undefined

  if (!productId || !licenseId) {
    return Response.json({ state: 'INVALID', error: 'missing_fields' }, { status: 422 })
  }

  const product = await db.product.findFirst({ where: { slug: productId } })
  if (!product) {
    return Response.json({ state: 'INVALID', error: 'unknown_product' }, { status: 422 })
  }

  if (!verifyLicenseText(license_text, product.publicKeyB64)) {
    return Response.json({ state: 'INVALID', error: 'invalid_signature' }, { status: 422 })
  }

  const license = await db.license.findUnique({ where: { id: licenseId } })
  if (!license) {
    return Response.json({ state: 'INVALID', error: 'license_not_found' }, { status: 404 })
  }

  const info = buildEnforcementInfo(license)

  await db.auditEvent.create({
    data: {
      licenseId: license.id,
      type: 'VALIDATE',
      payload: { client_ip: req.headers.get('x-forwarded-for') } as Prisma.InputJsonValue,
    },
  })

  return Response.json({
    state: info.state,
    license_id: license.id,
    tier: info.tier,
    features: info.features,
    limits: info.limits,
    expires_at: info.expires_at,
    grace_period_days: info.grace_period_days,
    heartbeat_url: info.heartbeat_url,
    new_license: null,
  })
}
