import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { parsePagination, paginatedResponse } from '@/lib/pagination'

function req(query: string) {
  return new NextRequest(`http://localhost/api/test${query}`)
}

describe('parsePagination', () => {
  it('defaults to page=1 pageSize=20', () => {
    const p = parsePagination(req(''))
    expect(p).toEqual({ page: 1, pageSize: 20, skip: 0, take: 20 })
  })

  it('parses explicit page and pageSize', () => {
    const p = parsePagination(req('?page=3&pageSize=10'))
    expect(p).toEqual({ page: 3, pageSize: 10, skip: 20, take: 10 })
  })

  it('clamps page < 1 to 1', () => {
    expect(parsePagination(req('?page=0')).page).toBe(1)
    expect(parsePagination(req('?page=-5')).page).toBe(1)
  })

  it('clamps pageSize > 100 to 100', () => {
    expect(parsePagination(req('?pageSize=999')).pageSize).toBe(100)
  })

  it('clamps pageSize < 1 to default 20', () => {
    expect(parsePagination(req('?pageSize=0')).pageSize).toBe(20)
    expect(parsePagination(req('?pageSize=-1')).pageSize).toBe(20)
  })

  it('treats non-numeric page as 1', () => {
    expect(parsePagination(req('?page=abc')).page).toBe(1)
  })

  it('treats non-numeric pageSize as 20', () => {
    expect(parsePagination(req('?pageSize=abc')).pageSize).toBe(20)
  })

  it('computes skip correctly for page 2 pageSize 10', () => {
    const p = parsePagination(req('?page=2&pageSize=10'))
    expect(p.skip).toBe(10)
    expect(p.take).toBe(10)
  })
})

describe('paginatedResponse', () => {
  it('returns 200 with correct pagination meta', async () => {
    const params = { page: 1, pageSize: 10, skip: 0, take: 10 }
    const res = paginatedResponse(['a', 'b', 'c'], 3, params, 'http://localhost/api/test')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(['a', 'b', 'c'])
    expect(body.pagination).toEqual({ page: 1, pageSize: 10, total: 3, totalPages: 1 })
  })

  it('sets X-Total-Count header', async () => {
    const params = { page: 1, pageSize: 10, skip: 0, take: 10 }
    const res = paginatedResponse([], 42, params, 'http://localhost/api/test')
    expect(res.headers.get('X-Total-Count')).toBe('42')
  })

  it('returns totalPages=0 for empty result', async () => {
    const params = { page: 1, pageSize: 20, skip: 0, take: 20 }
    const res = paginatedResponse([], 0, params, 'http://localhost/api/test')
    const body = await res.json()
    expect(body.pagination.totalPages).toBe(0)
    expect(body.pagination.total).toBe(0)
  })

  it('includes rel=next link when more pages exist', async () => {
    const params = { page: 1, pageSize: 10, skip: 0, take: 10 }
    const res = paginatedResponse(new Array(10).fill(null), 25, params, 'http://localhost/api/test')
    const link = res.headers.get('Link')
    expect(link).toContain('rel="next"')
    expect(link).toContain('page=2')
    expect(link).not.toContain('rel="prev"')
  })

  it('includes rel=prev link on non-first page', async () => {
    const params = { page: 2, pageSize: 10, skip: 10, take: 10 }
    const res = paginatedResponse(new Array(10).fill(null), 25, params, 'http://localhost/api/test')
    const link = res.headers.get('Link')
    expect(link).toContain('rel="prev"')
    expect(link).toContain('page=1')
  })

  it('includes both prev and next on middle page', async () => {
    const params = { page: 2, pageSize: 10, skip: 10, take: 10 }
    const res = paginatedResponse(new Array(10).fill(null), 30, params, 'http://localhost/api/test')
    const link = res.headers.get('Link')
    expect(link).toContain('rel="prev"')
    expect(link).toContain('rel="next"')
  })

  it('no Link header on single page result', async () => {
    const params = { page: 1, pageSize: 20, skip: 0, take: 20 }
    const res = paginatedResponse(new Array(5).fill(null), 5, params, 'http://localhost/api/test')
    expect(res.headers.get('Link')).toBeNull()
  })

  it('last page has no rel=next', async () => {
    const params = { page: 3, pageSize: 10, skip: 20, take: 10 }
    const res = paginatedResponse(new Array(5).fill(null), 25, params, 'http://localhost/api/test')
    const link = res.headers.get('Link')
    expect(link).not.toContain('rel="next"')
    expect(link).toContain('rel="prev"')
  })
})
