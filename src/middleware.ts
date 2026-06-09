import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// PUBLIC_PATHS bypass session auth entirely.
// /api/openapi.json is intentionally public — it documents the public enforcement
// API (/api/v1/validate, /api/v1/heartbeat) for product integrators. Admin endpoint
// details are present in the spec; if that changes, remove it from this list.
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/v1/', '/api/proxy/', '/api/openapi.json', '/api/health']

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // nonce allows Next.js RSC bootstrap inline scripts without unsafe-inline
    `script-src 'self' 'nonce-${nonce}'`,
    // style-src: no unsafe-inline — all styles served from external CSS file
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

function withSecurityHeaders(res: NextResponse, nonce: string): NextResponse {
  res.headers.set('X-Request-ID', crypto.randomUUID())
  res.headers.set('Content-Security-Policy', buildCsp(nonce))
  // x-nonce is read by the root layout to pass nonce to Next.js script bootstrap
  res.headers.set('x-nonce', nonce)
  return res
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (isPublic) return withSecurityHeaders(NextResponse.next(), nonce)

  const token = req.cookies.get('lsrv_session')?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? '')
    await jwtVerify(token, secret)
    return withSecurityHeaders(NextResponse.next(), nonce)
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
