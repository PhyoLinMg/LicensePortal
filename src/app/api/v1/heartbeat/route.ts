import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { canonicalJson, verifyInstanceSignature, signHeartbeatResponse } from '@/lib/crypto'
import { toRfc3339 } from '@/lib/license'
import { buildEnforcementInfo } from '@/lib/enforce'
import { getClientIp } from '@/lib/request'
import { allow, claimNonce } from '@/lib/ratelimit'
import type { Prisma } from '@prisma/client'

// POST /api/v1/heartbeat
// Body (JSON):
// {
//   license_id, instance_id, version, usage: {...},
//   now, nonce, sequence,
//   signature: base64url(Ed25519 over canonical_json of all other fields),
//   instance_public_key?: base64 SPKI DER (first heartbeat only)
// }

const HeartbeatBodySchema = z.object({
  license_id: z.string().uuid(),
  instance_id: z.string().uuid(),
  version: z.string().optional(),
  usage: z.record(z.string(), z.unknown()).optional(),
  now: z.string().optional(),
  nonce: z.string().min(1).max(256),
  sequence: z.number().int().min(0),
  signature: z.string().min(1),
  instance_public_key: z.string().optional(),
})

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return hbError(400, 'invalid_json')
  }

  // Presence check first — preserves specific missing_fields error code for required fields
  const { license_id, instance_id, nonce, sequence, signature } = body
  if (!license_id || !instance_id || !nonce || sequence === undefined || !signature) {
    return hbError(400, 'missing_fields')
  }

  // Type/format validation — eliminates all `as T` casts on user-supplied fields
  const parsed = HeartbeatBodySchema.safeParse(body)
  if (!parsed.success) {
    const paths = new Set(parsed.error.issues.map(i => i.path[0] as string))
    if (paths.has('license_id')) return hbError(400, 'invalid_license_id')
    if (paths.has('instance_id')) return hbError(400, 'invalid_instance_id')
    if (paths.has('sequence')) return hbError(400, 'invalid_sequence')
    return hbError(400, 'invalid_request')
  }

  const {
    license_id: licenseId,
    instance_id: instanceId,
    version,
    usage,
    nonce: validatedNonce,
    sequence: validatedSequence,
    signature: validatedSignature,
    instance_public_key,
  } = parsed.data

  // Rate-limit per licenseId+IP pair: prevents a third party with the license file
  // from exhausting the 5-req/min window before the legitimate instance can poll.
  // Keying on licenseId alone lets any holder of the license token DoS the real instance.
  const ip = getClientIp(req) ?? 'unknown'
  const rl = allow(`heartbeat:${licenseId}:${ip}`, 5, 60_000)
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

  // Load license
  const license = await db.license.findUnique({
    where: { id: licenseId },
    include: { product: true },
  })
  if (!license) return hbError(404, 'license_not_found')

  // Revoked → tell instance immediately
  if (license.status === 'revoked') {
    return signedResponse(license.product.privateKeyEnc, {
      status: 'revoked',
      server_time: toRfc3339(new Date()),
      new_license: null,
      enforcement: buildEnforcementInfo(license),
    })
  }

  // Single-instance enforcement
  const boundId = license.instanceId

  if (boundId !== null && boundId !== instanceId) {
    return hbError(409, 'license_already_bound')
  }

  if (boundId === null) {
    // First heartbeat for this license — bind atomically
    if (!instance_public_key) return hbError(400, 'instance_public_key_required_on_first_heartbeat')

    // Proof-of-possession: verify signature against the provided public key before binding.
    // Prevents an attacker from claiming a license with a key they don't control.
    // Use raw body (not parsed.data) — Zod strips unknown keys, which would break the
    // canonical JSON the client signed.
    const { signature: _sig0, instance_public_key: _ipk0, ...toSign0 } = body
    if (!verifyInstanceSignature(canonicalJson(toSign0), validatedSignature, instance_public_key)) {
      return hbError(401, 'invalid_signature')
    }

    // Claim nonce only after signature is verified — unauthenticated requests must not
    // consume nonce slots and pollute the dedup map.
    if (!claimNonce('hb', `${licenseId}:${validatedNonce}`)) {
      return hbError(400, 'replay_rejected')
    }

    try {
      await db.$transaction(async (tx) => {
        const bound = await tx.license.updateMany({
          where: { id: license.id, instanceId: null },
          data: { instanceId: instanceId },
        })
        if (bound.count === 0) throw new Error('license_already_bound')

        await tx.instance.create({
          data: {
            licenseId: license.id,
            instanceUuid: instanceId,
            publicKey: instance_public_key,
            latestSequence: BigInt(validatedSequence),
            lastVersion: version ?? null,
            lastUsage: (usage ?? null) as Prisma.InputJsonValue,
          },
        })

        await tx.auditEvent.create({
          data: {
            licenseId: license.id,
            type: 'INSTANCE_BIND',
            payload: {
              instance_id: instanceId,
              client_ip: getClientIp(req),
            } as Prisma.InputJsonValue,
          },
        })
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'license_already_bound') {
        return hbError(409, 'license_already_bound')
      }
      throw err
    }
  } else {
    // Bound instance — verify and update
    const instance = await db.instance.findUnique({
      where: { instanceUuid: instanceId },
    })
    if (!instance) return hbError(500, 'instance_record_missing')

    // Replay protection: sequence must be strictly increasing
    if (BigInt(validatedSequence) <= instance.latestSequence) {
      return hbError(400, 'replay_rejected')
    }

    // Verify instance signature — hard-fail if key is missing on a bound instance
    if (!instance.publicKey) return hbError(500, 'instance_key_missing')
    const { signature: _sig, instance_public_key: _ipk, ...toSign } = body
    const payloadBytes = canonicalJson(toSign)
    const valid = verifyInstanceSignature(payloadBytes, validatedSignature, instance.publicKey)
    if (!valid) return hbError(401, 'invalid_signature')

    // Claim nonce after signature is verified — only authenticated requests consume a slot.
    if (!claimNonce('hb', `${licenseId}:${validatedNonce}`)) {
      return hbError(400, 'replay_rejected')
    }

    await db.instance.update({
      where: { id: instance.id },
      data: {
        latestSequence: BigInt(validatedSequence),
        lastSeenAt: new Date(),
        lastVersion: version ?? null,
        lastUsage: (usage ?? null) as Prisma.InputJsonValue,
      },
    })
  }

  await db.auditEvent.create({
    data: {
      licenseId: license.id,
      type: 'HEARTBEAT',
      payload: {
        instance_id: instanceId,
        version: version ?? null,
        usage: (usage ?? null) as Prisma.InputJsonValue,
        sequence: validatedSequence,
        client_ip: getClientIp(req),
      } as Prisma.InputJsonValue,
    },
  })

  return signedResponse(license.product.privateKeyEnc, {
    status: 'ok',
    server_time: toRfc3339(new Date()),
    new_license: null,
    enforcement: buildEnforcementInfo(license),
  })
}

function hbError(status: number, code: string) {
  return Response.json({ error: code }, { status })
}

function signedResponse(privateKeyEnc: string, body: object) {
  const sig = signHeartbeatResponse(body, privateKeyEnc)
  return Response.json({ ...body, signature: sig })
}
