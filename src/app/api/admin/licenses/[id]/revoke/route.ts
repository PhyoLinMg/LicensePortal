import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminAuth } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const err = await requireAdminAuth(req)
  if (err) return err

  const { id } = await params
  const { reason } = await req.json()
  if (!reason) return Response.json({ error: 'reason required' }, { status: 400 })

  const license = await db.license.findUnique({ where: { id } })
  if (!license) return Response.json({ error: 'not found' }, { status: 404 })
  if (license.status === 'revoked') {
    return Response.json({ error: 'already revoked' }, { status: 409 })
  }

  const updated = await db.license.update({
    where: { id },
    data: { status: 'revoked', revokedAt: new Date(), revokeReason: reason },
  })

  await db.auditEvent.create({
    data: { licenseId: id, type: 'REVOKE', payload: { reason } },
  })

  return Response.json({ ok: true, status: updated.status, revokedAt: updated.revokedAt })
}
