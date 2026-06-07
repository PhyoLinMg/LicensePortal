import { NextRequest } from 'next/server'
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
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return hbError(400, 'invalid_json')
  }

  const {
    license_id,
    instance_id,
    version,
    usage,
    now: clientNow,
    nonce,
    sequence,
    signature,
    instance_public_key,
  } = body

  if (!license_id || !instance_id || !nonce || sequence === undefined || !signature) {
    return hbError(400, 'missing_fields')
  }

  // Validate UUID format for license_id and instance_id before hitting the DB
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(license_id as string)) return hbError(400, 'invalid_license_id')
  if (!UUID_RE.test(instance_id as string)) return hbError(400, 'invalid_instance_id')

  // Validate sequence before BigInt() — catches null / non-integer / non-finite values
  if (typeof sequence !== 'number' || !Number.isFinite(sequence) || sequence < 0 || !Number.isInteger(sequence)) {
    return hbError(400, 'invalid_sequence')
  }

  // Rate-limit per license_id (not IP) — IP keying blocks all customers behind NAT.
  // 5 requests/min is generous for legitimate hourly polling + retries.
  if (!allow(`heartbeat:${license_id as string}`, 5, 60_000)) {
    return hbError(429, 'rate_limited')
  }

  // Load license
  const license = await db.license.findUnique({
    where: { id: license_id as string },
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

  if (boundId !== null && boundId !== (instance_id as string)) {
    return hbError(409, 'license_already_bound')
  }

  if (boundId === null) {
    // First heartbeat for this license — bind atomically
    if (!instance_public_key) return hbError(400, 'instance_public_key_required_on_first_heartbeat')

    // Proof-of-possession: verify signature against the provided public key before binding.
    // Prevents an attacker from claiming a license with a key they don't control.
    const { signature: _sig0, instance_public_key: _ipk0, ...toSign0 } = body
    if (!verifyInstanceSignature(canonicalJson(toSign0), signature as string, instance_public_key as string)) {
      return hbError(401, 'invalid_signature')
    }

    // Claim nonce only after signature is verified — unauthenticated requests must not
    // consume nonce slots and pollute the dedup map.
    if (!claimNonce('hb', `${license_id as string}:${nonce as string}`)) {
      return hbError(400, 'replay_rejected')
    }

    try {
      await db.$transaction(async (tx) => {
        const bound = await tx.license.updateMany({
          where: { id: license.id, instanceId: null },
          data: { instanceId: instance_id as string },
        })
        if (bound.count === 0) throw new Error('license_already_bound')

        await tx.instance.create({
          data: {
            licenseId: license.id,
            instanceUuid: instance_id as string,
            publicKey: instance_public_key as string,
            latestSequence: BigInt(sequence),
            lastVersion: (version as string) ?? null,
            lastUsage: (usage as object) ?? null,
          },
        })

        await tx.auditEvent.create({
          data: {
            licenseId: license.id,
            type: 'INSTANCE_BIND',
            payload: {
              instance_id: instance_id as string,
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
      where: { instanceUuid: instance_id as string },
    })
    if (!instance) return hbError(500, 'instance_record_missing')

    // Replay protection: sequence must be strictly increasing
    if (BigInt(sequence) <= instance.latestSequence) {
      return hbError(400, 'replay_rejected')
    }

    // Verify instance signature — hard-fail if key is missing on a bound instance
    if (!instance.publicKey) return hbError(500, 'instance_key_missing')
    const { signature: _sig, instance_public_key: _ipk, ...toSign } = body
    const payloadBytes = canonicalJson(toSign)
    const valid = verifyInstanceSignature(payloadBytes, signature as string, instance.publicKey)
    if (!valid) return hbError(401, 'invalid_signature')

    // Claim nonce after signature is verified — only authenticated requests consume a slot.
    if (!claimNonce('hb', `${license_id as string}:${nonce as string}`)) {
      return hbError(400, 'replay_rejected')
    }

    await db.instance.update({
      where: { id: instance.id },
      data: {
        latestSequence: BigInt(sequence),
        lastSeenAt: new Date(),
        lastVersion: (version as string) ?? null,
        lastUsage: (usage as object) ?? null,
      },
    })
  }

  await db.auditEvent.create({
    data: {
      licenseId: license.id,
      type: 'HEARTBEAT',
      payload: {
        instance_id: instance_id as string,
        version: (version as string) ?? null,
        usage: (usage ?? null) as Prisma.InputJsonValue,
        sequence: sequence,
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
