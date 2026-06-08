import { NextRequest } from 'next/server'

// Warn once at startup so operators know rate-limit IP isolation is inactive.
if (process.env.NODE_ENV === 'production' && !process.env.TRUSTED_PROXY_HEADER) {
  console.warn(
    '[security] TRUSTED_PROXY_HEADER is not set. ' +
    'IP-based rate limiting is disabled — all clients share a single bucket. ' +
    'Set to the header your reverse proxy writes (e.g. "x-real-ip" or "cf-connecting-ip").',
  )
}

/**
 * Extract the real client IP from a request.
 *
 * Reads only the header named by TRUSTED_PROXY_HEADER (e.g. "cf-connecting-ip"
 * or "x-real-ip"). That header must be set exclusively by a trusted reverse
 * proxy — never forwarded from clients.
 *
 * Returns null when TRUSTED_PROXY_HEADER is unset (direct deployment, no proxy)
 * or when the named header is absent. Callers that fall back to 'unknown' will
 * share a single rate-limit bucket, which is acceptable for direct deployments
 * that should not be internet-facing.
 *
 * X-Forwarded-For is intentionally excluded: it can be spoofed by clients to
 * create a fresh rate-limit bucket per request.
 */
export function getClientIp(req: NextRequest): string | null {
  const header = process.env.TRUSTED_PROXY_HEADER?.toLowerCase().trim()
  if (!header) return null
  return req.headers.get(header) ?? null
}
