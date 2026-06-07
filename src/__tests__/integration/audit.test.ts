import { describe, it, expect, beforeEach } from 'vitest'
import { POST as PRUNE } from '@/app/api/admin/audit/prune/route'
import { adminRequest, unauthRequest, truncateAll } from '@/__tests__/helpers'

describe('POST /api/admin/audit/prune', () => {
  beforeEach(truncateAll)

  it('deletes audit events older than the given days threshold', async () => {
    const { db } = await import('@/lib/db')

    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) // 100 days ago
    const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago

    await db.auditEvent.createMany({
      data: [
        { type: 'VALIDATE', payload: { note: 'old' }, createdAt: old },
        { type: 'VALIDATE', payload: { note: 'recent' }, createdAt: recent },
      ],
    })

    const req = await adminRequest('http://localhost/api/admin/audit/prune', {
      method: 'POST',
      body: JSON.stringify({ days: 90 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PRUNE(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.deleted).toBe(1)
    expect(body.days).toBe(90)

    const remaining = await db.auditEvent.findMany()
    expect(remaining).toHaveLength(1)
    expect((remaining[0].payload as Record<string, unknown>).note).toBe('recent')
  })

  it('uses 90-day default when no body is sent', async () => {
    const req = await adminRequest('http://localhost/api/admin/audit/prune', {
      method: 'POST',
    })
    const res = await PRUNE(req)
    expect(res.status).toBe(200)
    expect((await res.json()).days).toBe(90)
  })

  it('returns 401 without auth', async () => {
    const req = unauthRequest('http://localhost/api/admin/audit/prune', { method: 'POST' })
    const res = await PRUNE(req)
    expect(res.status).toBe(401)
  })
})
