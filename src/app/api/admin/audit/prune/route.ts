import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminAuth } from '@/lib/auth'

const MIN_RETENTION_DAYS = 90

// POST /api/admin/audit/prune
// Deletes AuditEvent rows older than `days` (default 90, minimum 90).
// Writes an AUDIT_PRUNE event before executing the delete so the prune
// itself is traceable even if a future prune would otherwise remove it.
//
// Request body (optional): { "days": 180 }
// Response: { "deleted": <count>, "days": <number>, "cutoff": <iso> }
export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(req)
  if (err) return err

  let days = MIN_RETENTION_DAYS
  try {
    const body = await req.json()
    if (typeof body.days === 'number' && body.days > 0) days = Math.floor(body.days)
  } catch {
    // no body is fine — use default
  }

  if (days < MIN_RETENTION_DAYS) {
    await db.auditEvent.create({
      data: {
        type: 'AUDIT_PRUNE_REJECTED',
        payload: { requested_days: days, min_days: MIN_RETENTION_DAYS },
      },
    })
    return Response.json(
      { error: 'minimum_retention_days', min: MIN_RETENTION_DAYS },
      { status: 400 },
    )
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Log the prune attempt before executing — ensures the event survives even
  // if the delete removes old AUDIT_PRUNE rows on the next run.
  await db.auditEvent.create({
    data: {
      type: 'AUDIT_PRUNE',
      payload: { days, cutoff: cutoff.toISOString() },
    },
  })

  const result = await db.auditEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })

  return Response.json({ deleted: result.count, cutoff: cutoff.toISOString(), days })
}
