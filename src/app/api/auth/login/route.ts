import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { createSession, sessionCookieHeader } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  const adminEmail = process.env.ADMIN_EMAIL
  const adminHash = process.env.ADMIN_PASSWORD_HASH

  if (!adminEmail || !adminHash) {
    return Response.json({ error: 'Server not configured' }, { status: 500 })
  }

  const emailMatch = email === adminEmail
  const passwordMatch = emailMatch && (await bcrypt.compare(password, adminHash))

  if (!emailMatch || !passwordMatch) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await createSession()
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader(token),
    },
  })
}
