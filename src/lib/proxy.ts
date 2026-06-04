import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { computeState } from '@/lib/enforce'

// PROXY_UPSTREAM_URL is the generic name; fall back to legacy HANDOFF_INTERNAL_URL for existing deployments
function upstreamUrl(): string | undefined {
  return process.env.PROXY_UPSTREAM_URL ?? process.env.HANDOFF_INTERNAL_URL
}

// Comma-separated path prefixes that bypass the license gate (e.g. "api/jobs/,api/health/")
const GATE_BYPASS_PREFIXES = (process.env.PROXY_BYPASS_PREFIXES ?? 'api/jobs/')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

type GateDenial = { status: 402; error: string }
let gateCache: { until: number; denial: GateDenial | null } | null = null

export async function gate(path: string[]): Promise<NextResponse | null> {
  if (!upstreamUrl()) return null  // proxy not configured — let forward() return 404
  const joined = path.join('/')
  if (GATE_BYPASS_PREFIXES.some((p) => joined.startsWith(p))) return null

  const now = Date.now()
  if (gateCache && now < gateCache.until) {
    return gateCache.denial
      ? NextResponse.json({ error: gateCache.denial.error }, { status: 402 })
      : null
  }

  const license = await db.license.findFirst({
    where: { status: 'active' },
    orderBy: { issuedAt: 'desc' },
  })

  let denial: GateDenial | null = null
  if (!license) {
    denial = { status: 402, error: 'NO_LICENSE' }
  } else {
    const state = computeState(license)
    if (state !== 'VALID') denial = { status: 402, error: state }
  }

  gateCache = { until: now + 10_000, denial }
  return denial ? NextResponse.json({ error: denial.error }, { status: 402 }) : null
}

function stripHopByHop(headers: Headers): Headers {
  const out = new Headers()
  headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out.set(key, value)
  })
  return out
}

export async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  const upstreamBase = upstreamUrl()
  if (!upstreamBase) {
    return NextResponse.json({ error: 'PROXY_NOT_CONFIGURED' }, { status: 404 })
  }
  const url = `${upstreamBase}/${path.join('/')}${req.nextUrl.search}`
  const hasBody = !['GET', 'HEAD'].includes(req.method)
  const res = await fetch(url, {
    method: req.method,
    headers: stripHopByHop(req.headers),
    body: hasBody ? req.body : undefined,
    // @ts-ignore — duplex required for streaming request bodies in Node 18+
    duplex: 'half',
  })
  return new NextResponse(res.body, {
    status: res.status,
    headers: stripHopByHop(res.headers),
  })
}
