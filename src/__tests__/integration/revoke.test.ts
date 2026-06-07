import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/admin/licenses/[id]/revoke/route'
import { GET as LIST_GET, POST as LIST_POST } from '@/app/api/admin/licenses/route'
import { adminRequest, unauthRequest, truncateAll, createProduct, createCustomer } from '@/__tests__/helpers'

describe('POST /api/admin/licenses/[id]/revoke', () => {
  let licenseId: string

  beforeEach(async () => {
    await truncateAll()
    const product = await createProduct()
    const customer = await createCustomer()

    const req = await adminRequest('http://localhost/api/admin/licenses', {
      method: 'POST',
      body: JSON.stringify({
        productId: product.id,
        customerId: customer.id,
        tier: 'pro',
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await LIST_POST(req)
    licenseId = (await res.json()).id
  })

  it('revokes a license and returns ok', async () => {
    const req = await adminRequest(`http://localhost/api/admin/licenses/${licenseId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'non-payment' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: licenseId }) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('revoked')
    expect(body.revokedAt).toBeTruthy()
  })

  it('persists revokedAt and revokeReason', async () => {
    const req = await adminRequest(`http://localhost/api/admin/licenses/${licenseId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'contract ended' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req, { params: Promise.resolve({ id: licenseId }) })

    const { db } = await import('@/lib/db')
    const license = await db.license.findUnique({ where: { id: licenseId } })
    expect(license!.status).toBe('revoked')
    expect(license!.revokeReason).toBe('contract ended')
    expect(license!.revokedAt).toBeTruthy()
  })

  it('creates a REVOKE audit event', async () => {
    const req = await adminRequest(`http://localhost/api/admin/licenses/${licenseId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req, { params: Promise.resolve({ id: licenseId }) })

    const { db } = await import('@/lib/db')
    const events = await db.auditEvent.findMany({ where: { type: 'REVOKE' } })
    expect(events).toHaveLength(1)
    expect((events[0].payload as Record<string, unknown>).reason).toBe('test')
  })

  it('returns 409 when revoking an already-revoked license', async () => {
    const req1 = await adminRequest(`http://localhost/api/admin/licenses/${licenseId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'first' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req1, { params: Promise.resolve({ id: licenseId }) })

    const req2 = await adminRequest(`http://localhost/api/admin/licenses/${licenseId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'second' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req2, { params: Promise.resolve({ id: licenseId }) })
    expect(res.status).toBe(409)
  })

  it('returns 400 when reason is missing', async () => {
    const req = await adminRequest(`http://localhost/api/admin/licenses/${licenseId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: licenseId }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent license', async () => {
    const fake = '00000000-0000-0000-0000-000000000000'
    const req = await adminRequest(`http://localhost/api/admin/licenses/${fake}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'gone' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: fake }) })
    expect(res.status).toBe(404)
  })

  it('returns 401 without auth', async () => {
    const req = unauthRequest(`http://localhost/api/admin/licenses/${licenseId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'unauth' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({ id: licenseId }) })
    expect(res.status).toBe(401)
  })
})
