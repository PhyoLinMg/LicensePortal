import { NextRequest } from 'next/server'
import { gate, forward } from '@/lib/proxy'

export const runtime = 'nodejs'

type Context = { params: Promise<{ path: string[] }> }

async function handle(req: NextRequest, ctx: Context) {
  const { path } = await ctx.params
  const blocked = await gate(path)
  if (blocked) return blocked
  return forward(req, path)
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
