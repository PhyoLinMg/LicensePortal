import { NextRequest } from 'next/server'

const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 20

export interface PaginationParams {
  page: number
  pageSize: number
  skip: number
  take: number
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export function parsePagination(req: NextRequest): PaginationParams {
  const url = new URL(req.url)
  const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10)
  const rawPageSize = parseInt(url.searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10)
  const page = !rawPage || rawPage < 1 ? 1 : rawPage
  const pageSize = !rawPageSize || rawPageSize < 1
    ? DEFAULT_PAGE_SIZE
    : Math.min(rawPageSize, MAX_PAGE_SIZE)
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  params: PaginationParams,
  reqUrl: string,
): Response {
  const totalPages = Math.ceil(total / params.pageSize)
  const meta: PaginationMeta = { page: params.page, pageSize: params.pageSize, total, totalPages }

  const headers = new Headers({ 'Content-Type': 'application/json' })
  headers.set('X-Total-Count', String(total))

  const links: string[] = []
  const url = new URL(reqUrl)
  if (params.page > 1) {
    url.searchParams.set('page', String(params.page - 1))
    url.searchParams.set('pageSize', String(params.pageSize))
    links.push(`<${url.toString()}>; rel="prev"`)
  }
  if (params.page < totalPages) {
    url.searchParams.set('page', String(params.page + 1))
    url.searchParams.set('pageSize', String(params.pageSize))
    links.push(`<${url.toString()}>; rel="next"`)
  }
  if (links.length > 0) headers.set('Link', links.join(', '))

  return new Response(JSON.stringify({ data: items, pagination: meta }), { status: 200, headers })
}
