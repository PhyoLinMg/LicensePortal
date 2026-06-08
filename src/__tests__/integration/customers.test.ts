import { describe, it, expect, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/admin/customers/route'
import { adminRequest, unauthRequest, truncateAll } from '@/__tests__/helpers'

describe('Admin customers API', () => {
  beforeEach(truncateAll)

  // ── GET ──────────────────────────────────────────────────────────────────

  it('GET returns empty paginated list initially', async () => {
    const req = await adminRequest('http://localhost/api/admin/customers')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.pagination.total).toBe(0)
    expect(res.headers.get('X-Total-Count')).toBe('0')
  })

  it('GET returns 401 without auth', async () => {
    const req = unauthRequest('http://localhost/api/admin/customers')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('GET lists created customers with license count in paginated shape', async () => {
    const createReq = await adminRequest('http://localhost/api/admin/customers', {
      method: 'POST',
      body: JSON.stringify({ name: 'Acme Corp', email: 'acme@test.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(createReq)

    const listReq = await adminRequest('http://localhost/api/admin/customers')
    const res = await GET(listReq)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('Acme Corp')
    expect(body.data[0]._count.licenses).toBe(0)
    expect(body.pagination.total).toBe(1)
    expect(res.headers.get('X-Total-Count')).toBe('1')
  })

  // ── POST ─────────────────────────────────────────────────────────────────

  it('POST creates a customer and returns 201', async () => {
    const req = await adminRequest('http://localhost/api/admin/customers', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Customer', email: 'new@test.com', notes: 'VIP' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)

    const customer = await res.json()
    expect(customer.name).toBe('New Customer')
    expect(customer.email).toBe('new@test.com')
    expect(customer.notes).toBe('VIP')
  })

  it('POST returns 400 when name is missing', async () => {
    const req = await adminRequest('http://localhost/api/admin/customers', {
      method: 'POST',
      body: JSON.stringify({ email: 'no-name@test.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('POST returns 401 without auth', async () => {
    const req = unauthRequest('http://localhost/api/admin/customers', {
      method: 'POST',
      body: JSON.stringify({ name: 'X' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
