import { NextRequest } from 'next/server'
import { clearCookieHeader, revokeSession } from '@/lib/auth'

const COOKIE = 'lsrv_session'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value
  if (token) await revokeSession(token)

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearCookieHeader(),
    },
  })
}
