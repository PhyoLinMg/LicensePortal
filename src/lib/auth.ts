import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'

const COOKIE = 'lsrv_session'
const ALG = 'HS256'
const SESSION_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

// Sweep expired sessions once at module load — prevents unbounded table growth.
db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => null)

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET not set')
  return new TextEncoder().encode(s)
}

export async function createSession(): Promise<string> {
  const jti = randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await db.session.create({ data: { jti, expiresAt } })

  return new SignJWT({ role: 'admin', jti })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(getSecret())
}

export async function verifySession(token: string): Promise<boolean> {
  let payload: { jti?: string }
  try {
    const result = await jwtVerify(token, getSecret())
    payload = result.payload as { jti?: string }
  } catch {
    return false
  }

  const jti = payload.jti
  if (!jti) return false

  // Fail-closed: DB down = session invalid. Revocation requires DB lookup.
  const session = await db.session.findUnique({ where: { jti } })
  if (!session) return false

  // Prune expired rows lazily on valid lookups
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { jti } }).catch(() => null)
    return false
  }

  return true
}

export async function revokeSession(token: string): Promise<void> {
  let jti: string | undefined
  try {
    const result = await jwtVerify(token, getSecret())
    jti = (result.payload as { jti?: string }).jti
  } catch {
    // Invalid token — nothing to revoke
    return
  }
  if (jti) {
    await db.session.delete({ where: { jti } }).catch(() => null)
  }
}

export async function getSessionToken(): Promise<string | undefined> {
  const jar = await cookies()
  return jar.get(COOKIE)?.value
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getSessionToken()
  if (!token) return false
  return verifySession(token)
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/${secure}; Max-Age=7200`
}

export function clearCookieHeader(): string {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
}

// For use in API route handlers — reads cookie from request
export async function requireAdminAuth(req: NextRequest): Promise<Response | null> {
  const token = req.cookies.get(COOKIE)?.value
  if (!token || !(await verifySession(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
