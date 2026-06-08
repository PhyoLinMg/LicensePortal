import { buildOpenApiDocument } from '@/lib/openapi'

export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json(buildOpenApiDocument(), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
