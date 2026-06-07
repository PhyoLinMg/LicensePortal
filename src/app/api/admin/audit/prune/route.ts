import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdminAuth } from '@/lib/auth'

// POST /api/admin/audit/prune
// Deletes AuditEvent rows older than `days` (default 90).
// Run periodically (e.g. weekly via cron or a scheduled job hitting this endpoint).
//
// Request body (optional): { "days": 90 }
// Response: { "deleted": <count> }
export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(req)
  if (err) return err

  let days = 90
  try {
    const body = await req.json()
    if (typeof body.days === 'number' && body.days > 0) days = Math.floor(body.days)
  } catch {
    // no body is fine — use default
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const result = await db.auditEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })

  return Response.json({ deleted: result.count, cutoff: cutoff.toISOString(), days })
}
