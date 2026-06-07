import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'crypto'
import { toRfc3339, buildPayload } from '@/lib/license'
import { generateProductKeypair } from '@/lib/crypto'
import type { IssueLicenseInput } from '@/lib/license'

// ── toRfc3339 ─────────────────────────────────────────────────────────────────

describe('toRfc3339', () => {
  it('strips milliseconds from ISO string', () => {
    expect(toRfc3339(new Date('2026-06-08T12:34:56.789Z'))).toBe('2026-06-08T12:34:56Z')
  })

  it('handles zero milliseconds', () => {
    expect(toRfc3339(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T00:00:00Z')
  })

  it('output always ends with Z (UTC marker)', () => {
    expect(toRfc3339(new Date())).toMatch(/Z$/)
  })
})

// ── buildPayload ──────────────────────────────────────────────────────────────

describe('buildPayload', () => {
  let keypair: ReturnType<typeof generateProductKeypair>
  let input: IssueLicenseInput

  beforeAll(() => {
    process.env.KEK_BASE64 = randomBytes(32).toString('base64')
    keypair = generateProductKeypair()
    input = {
      licenseId: 'lic-abc',
      productSlug: 'my-product',
      productIssuer: 'my-issuer',
      keyId: 'v1',
      customerId: 'cust-1',
      customerName: 'Acme Corp',
      tier: 'pro',
      features: ['intake', 'itglue'],
      limits: { max_clients: 100 },
      notBefore: new Date('2026-01-01T00:00:00Z'),
      expiresAt: new Date('2027-01-01T00:00:00Z'),
      gracePeriodDays: 21,
      heartbeatUrl: 'https://license.example.com/api/v1/heartbeat',
      privateKeyEnc: keypair.privateKeyEnc,
    }
  })

  it('maps all wire-protocol field names correctly', () => {
    const p = buildPayload(input)
    // These field names are the signed wire-protocol keys — a typo here
    // breaks every deployed license that uses them.
    expect(p.schema_version).toBe(1)
    expect(p.license_id).toBe('lic-abc')
    expect(p.product_id).toBe('my-product')
    expect(p.issuer).toBe('my-issuer')
    expect(p.key_id).toBe('v1')
    expect(p.customer_id).toBe('cust-1')
    expect(p.customer_name).toBe('Acme Corp')
    expect(p.tier).toBe('pro')
    expect(p.features).toEqual(['intake', 'itglue'])
    expect(p.limits).toEqual({ max_clients: 100 })
    expect(p.grace_period_days).toBe(21)
    expect(p.heartbeat_url).toBe('https://license.example.com/api/v1/heartbeat')
  })

  it('not_before and expires_at are RFC3339 strings without milliseconds', () => {
    const p = buildPayload(input)
    expect(p.not_before).toBe('2026-01-01T00:00:00Z')
    expect(p.expires_at).toBe('2027-01-01T00:00:00Z')
  })

  it('instance_id is null at issue time (bound on first heartbeat)', () => {
    expect(buildPayload(input).instance_id).toBeNull()
  })

  it('issued_at is a recent RFC3339 timestamp', () => {
    // Floor to seconds: toRfc3339 strips milliseconds, so issuedMs will be
    // at the second boundary which may be before the sub-second `before`.
    const beforeSec = Math.floor(Date.now() / 1000) * 1000
    const p = buildPayload(input)
    const afterSec = (Math.floor(Date.now() / 1000) + 1) * 1000
    const issuedMs = new Date(p.issued_at).getTime()
    expect(issuedMs).toBeGreaterThanOrEqual(beforeSec)
    expect(issuedMs).toBeLessThanOrEqual(afterSec)
    expect(p.issued_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  })
})
