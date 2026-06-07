import { NextRequest } from 'next/server'

/**
 * Extract the real client IP from a request.
 *
 * Priority:
 *  1. CF-Connecting-IP  — set by Cloudflare, single trusted value
 *  2. X-Real-IP         — set by nginx / most reverse proxies
 *  3. X-Forwarded-For   — rightmost untrusted entry (last hop added by our proxy)
 *
 * Falls back to null when running without a reverse proxy (direct connections
 * expose no IP header in Next.js edge/node runtime).
 *
 * IMPORTANT: this is only trustworthy when the server sits behind exactly one
 * trusted proxy that sets one of the above headers. Multi-hop or untrusted
 * proxies should use the rightmost X-Forwarded-For entry, which this does.
 */
export function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ??
    null
  )
}
