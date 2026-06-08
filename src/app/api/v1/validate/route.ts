import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { parseLicensePayload, verifyLicenseText } from '@/lib/crypto'
import { buildEnforcementInfo } from '@/lib/enforce'
import { getClientIp } from '@/lib/request'
import { allow } from '@/lib/ratelimit'
import type { Prisma } from '@prisma/client'

// POST /api/v1/validate
// Validates a license token and returns the current enforcement state.
// No auth required — the license text itself is the credential.
// Called by the product binary on boot and periodically to poll enforcement state.
//
// Request:  { license_text: string }
// Response: { state, license_id, tier, features, limits, expires_at,
//             grace_period_days, heartbeat_url, new_license }

const ValidateBodySchema = z.object({
  license_text: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req) ?? 'unknown'
  const rl = allow(`validate:${ip}`, 30, 60_000)
  if (!rl.ok) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rl.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
      },
    })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = ValidateBodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'license_text required' }, { status: 400 })
  }
  const { license_text } = parsed.data

  let payload: Record<string, unknown>
  try {
    payload = parseLicensePayload(license_text)
  } catch {
    return Response.json({ state: 'INVALID', error: 'malformed_license' }, { status: 422 })
  }

  const productId = payload.product_id
  const licenseId = payload.license_id

  if (typeof productId !== 'string' || typeof licenseId !== 'string' || !productId || !licenseId) {
    return Response.json({ state: 'INVALID', error: 'missing_fields' }, { status: 422 })
  }

  const product = await db.product.findUnique({ where: { slug: productId } })
  // Collapse unknown_product + invalid_signature into one code — prevents
  // product slug enumeration by distinguishing "slug exists" from "slug absent".
  if (!product) {
    return Response.json({ state: 'INVALID', error: 'invalid_license' }, { status: 422 })
  }

  if (!verifyLicenseText(license_text, product.publicKeyB64)) {
    return Response.json({ state: 'INVALID', error: 'invalid_license' }, { status: 422 })
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
      payload: { client_ip: getClientIp(req) } as Prisma.InputJsonValue,
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
