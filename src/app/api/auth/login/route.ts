import { NextRequest } from 'next/server'
import { z } from 'zod'
import { timingSafeEqual } from 'crypto'
import bcrypt from 'bcryptjs'
import { createSession, sessionCookieHeader } from '@/lib/auth'
import { db } from '@/lib/db'
import { getClientIp } from '@/lib/request'
import { allow } from '@/lib/ratelimit'

const LoginBodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  // Pad to equal length so timingSafeEqual never throws and no early return leaks length info.
  const len = Math.max(ab.length, bb.length)
  const ap = Buffer.alloc(len)
  const bp = Buffer.alloc(len)
  ab.copy(ap)
  bb.copy(bp)
  return timingSafeEqual(ap, bp) && ab.length === bb.length
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req) ?? 'unknown'
  // 10 attempts per 15 minutes per IP
  if (!allow(`login:${ip}`, 10, 15 * 60_000)) {
    return Response.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const parsed = LoginBodySchema.safeParse(body)
  if (!parsed.success) {
    // Always run bcrypt on parse failure to prevent timing attacks that reveal missing fields.
    await bcrypt.compare('__invalid__', '$2b$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
    return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  const { email, password } = parsed.data

  const adminEmail = process.env.ADMIN_EMAIL
  const adminHash = process.env.ADMIN_PASSWORD_HASH

  if (!adminEmail || !adminHash) {
    return Response.json({ error: 'Server not configured' }, { status: 500 })
  }

  if (!/^\$2[aby]\$\d{2}\$/.test(adminHash)) {
    console.error('ADMIN_PASSWORD_HASH has invalid bcrypt format')
    return Response.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  const rounds = parseInt(adminHash.split('$')[2], 10)
  if (rounds < 10) {
    console.error(`ADMIN_PASSWORD_HASH uses weak rounds: ${rounds}`)
    return Response.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  // Always run bcrypt regardless of email match — never short-circuit.
  // Skipping bcrypt on email mismatch leaks ~250ms that reveals valid admin emails.
  const passwordMatch = await bcrypt.compare(password, adminHash)
  const emailMatch = safeEqual(email, adminEmail)

  if (!emailMatch || !passwordMatch) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createSession()

  await db.auditEvent.create({
    data: { type: 'ADMIN_LOGIN', payload: { email: adminEmail, client_ip: getClientIp(req) } },
  })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader(token),
    },
  })
}
