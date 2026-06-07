import { describe, it, expect, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/admin/products/route'
import { adminRequest, unauthRequest, truncateAll } from '@/__tests__/helpers'

describe('Admin products API', () => {
  beforeEach(truncateAll)

  // ── GET ──────────────────────────────────────────────────────────────────

  it('GET returns empty list initially', async () => {
    const req = await adminRequest('http://localhost/api/admin/products')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('GET returns 401 without auth', async () => {
    const req = unauthRequest('http://localhost/api/admin/products')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('GET excludes privateKeyEnc from response', async () => {
    const createReq = await adminRequest('http://localhost/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Product', slug: 'my-prod' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(createReq)

    const listReq = await adminRequest('http://localhost/api/admin/products')
    const res = await GET(listReq)
    const products = await res.json()
    expect(products).toHaveLength(1)
    expect(products[0]).not.toHaveProperty('privateKeyEnc')
    expect(products[0]).toHaveProperty('publicKeyB64')
  })

  // ── POST ─────────────────────────────────────────────────────────────────

  it('POST creates a product and returns 201', async () => {
    const req = await adminRequest('http://localhost/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'Handoff', slug: 'handoff' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)

    const product = await res.json()
    expect(product.name).toBe('Handoff')
    expect(product.slug).toBe('handoff')
    expect(product.keyId).toBe('v1')
    expect(product.publicKeyB64).toBeTruthy()
  })

  it('POST returns 400 when name is missing', async () => {
    const req = await adminRequest('http://localhost/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({ slug: 'no-name' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST returns 400 when slug is missing', async () => {
    const req = await adminRequest('http://localhost/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'No Slug' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST returns 401 without auth', async () => {
    const req = unauthRequest('http://localhost/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X', slug: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('POST creates a PRODUCT_CREATE audit event', async () => {
    const req = await adminRequest('http://localhost/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'Audited', slug: 'audited' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req)

    const { db } = await import('@/lib/db')
    const events = await db.auditEvent.findMany({ where: { type: 'PRODUCT_CREATE' } })
    expect(events).toHaveLength(1)
    const payload = events[0].payload as Record<string, unknown>
    expect(payload.slug).toBe('audited')
  })
})
