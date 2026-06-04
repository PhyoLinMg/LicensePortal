import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminAuth } from '@/lib/auth'

// POST /api/admin/licenses/[id]/rebind
// Clears the instance binding so a new instance can heartbeat in.
// Use when a customer's server is replaced and the old instance_id is gone.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = await requireAdminAuth(req)
  if (err) return err

  const { id } = await params

  const license = await db.license.findUnique({ where: { id } })
  if (!license) return Response.json({ error: 'not_found' }, { status: 404 })
  if (license.status === 'revoked') {
    return Response.json({ error: 'license_revoked' }, { status: 409 })
  }

  const previousInstanceId = license.instanceId

  await db.$transaction(async (tx) => {
    await tx.license.update({
      where: { id },
      data: { instanceId: null },
    })

    if (previousInstanceId) {
      await tx.instance.deleteMany({
        where: { licenseId: id },
      })
    }

    await tx.auditEvent.create({
      data: {
        licenseId: id,
        type: 'INSTANCE_REBIND',
        payload: { previous_instance_id: previousInstanceId ?? null },
      },
    })
  })

  return Response.json({ ok: true, previous_instance_id: previousInstanceId ?? null })
}
