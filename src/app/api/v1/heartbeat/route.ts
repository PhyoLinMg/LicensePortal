import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { canonicalJson, verifyInstanceSignature, signHeartbeatResponse } from '@/lib/crypto'
import { toRfc3339 } from '@/lib/license'
import { buildEnforcementInfo } from '@/lib/enforce'
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
            latestSequence: BigInt(sequence as number),
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
              client_ip: req.headers.get('x-forwarded-for'),
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
    if (BigInt(sequence as number) <= instance.latestSequence) {
      return hbError(400, 'replay_rejected')
    }

    // Verify instance signature
    if (instance.publicKey) {
      const { signature: _sig, instance_public_key: _ipk, ...toSign } = body
      const payloadBytes = canonicalJson(toSign)
      const valid = verifyInstanceSignature(payloadBytes, signature as string, instance.publicKey)
      if (!valid) return hbError(401, 'invalid_signature')
    }

    await db.instance.update({
      where: { id: instance.id },
      data: {
        latestSequence: BigInt(sequence as number),
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
        sequence: sequence as number,
        client_ip: req.headers.get('x-forwarded-for'),
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
