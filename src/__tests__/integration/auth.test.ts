import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/login/route'
import { truncateAll, TEST_PASSWORD } from '@/__tests__/helpers'
import { NextRequest } from 'next/server'

function loginReq(body: object): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/auth/login', () => {
  beforeEach(truncateAll)

  it('returns 200 with session cookie on valid credentials', async () => {
    const req = loginReq({ email: 'test@example.com', password: TEST_PASSWORD })
    const res = await POST(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.ok).toBe(true)

    const setCookie = res.headers.get('Set-Cookie')
    expect(setCookie).toContain('lsrv_session=')
    expect(setCookie).toContain('HttpOnly')
  })

  it('returns 401 on wrong password', async () => {
    const req = loginReq({ email: 'test@example.com', password: 'wrong' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Invalid credentials')
  })

  it('returns 401 on wrong email', async () => {
    const req = loginReq({ email: 'nobody@example.com', password: TEST_PASSWORD })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 on empty body (treated as wrong credentials, not 400)', async () => {
    const req = loginReq({})
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('creates an ADMIN_LOGIN audit event', async () => {
    const req = loginReq({ email: 'test@example.com', password: TEST_PASSWORD })
    await POST(req)

    const { db } = await import('@/lib/db')
    const events = await db.auditEvent.findMany({ where: { type: 'ADMIN_LOGIN' } })
    expect(events).toHaveLength(1)
  })

  it('returns 429 after 10 attempts from same IP within 15 minutes', async () => {
    // Rate limiter reset between tests by vitest.setup.ts (__resetForTesting)
    let lastRes: Response | null = null
    for (let i = 0; i < 11; i++) {
      lastRes = await POST(loginReq({ email: 'test@example.com', password: 'wrong' }))
    }
    expect(lastRes!.status).toBe(429)
    expect((await lastRes!.json()).error).toBe('rate_limited')
  })
})
