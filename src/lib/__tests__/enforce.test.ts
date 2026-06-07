import { describe, it, expect } from 'vitest'
import { computeState, buildEnforcementInfo } from '@/lib/enforce'
import type { License } from '@prisma/client'

function makeLicense(overrides: Partial<License> = {}): License {
  return {
    id: 'lic-1',
    customerId: 'cust-1',
    productId: 'prod-1',
    keyId: 'v1',
    tier: 'pro',
    features: ['intake'],
    limits: { max_clients: 50 },
    instanceId: null,
    issuedAt: new Date('2025-01-01'),
    notBefore: new Date('2025-01-01'),
    expiresAt: new Date('2099-01-01'),
    gracePeriodDays: 21,
    heartbeatUrl: 'https://license.example.com/api/v1/heartbeat',
    status: 'active',
    revokedAt: null,
    revokeReason: null,
    payloadJson: {},
    signature: 'sig',
    licenseText: 'payload.sig',
    ...overrides,
  } as unknown as License
}

// ── computeState ──────────────────────────────────────────────────────────────

describe('computeState', () => {
  it('active license with future expiry → VALID', () => {
    expect(computeState(makeLicense())).toBe('VALID')
  })

  it('active license with past expiry → EXPIRED', () => {
    expect(computeState(makeLicense({ expiresAt: new Date('2000-01-01') }))).toBe('EXPIRED')
  })

  it('revoked license with future expiry → REVOKED (status beats expiry)', () => {
    expect(computeState(makeLicense({ status: 'revoked' }))).toBe('REVOKED')
  })

  it('revoked license with past expiry → REVOKED (not EXPIRED)', () => {
    expect(
      computeState(makeLicense({ status: 'revoked', expiresAt: new Date('2000-01-01') }))
    ).toBe('REVOKED')
  })
})

// ── buildEnforcementInfo ──────────────────────────────────────────────────────

describe('buildEnforcementInfo', () => {
  it('maps all fields correctly for an active license', () => {
    const lic = makeLicense()
    const info = buildEnforcementInfo(lic)
    expect(info.state).toBe('VALID')
    expect(info.tier).toBe('pro')
    expect(info.features).toEqual(['intake'])
    expect(info.limits).toEqual({ max_clients: 50 })
    expect(info.grace_period_days).toBe(21)
    expect(info.heartbeat_url).toBe('https://license.example.com/api/v1/heartbeat')
    // expires_at strips milliseconds
    expect(info.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  })

  it('null heartbeat_url passes through', () => {
    const info = buildEnforcementInfo(makeLicense({ heartbeatUrl: null }))
    expect(info.heartbeat_url).toBeNull()
  })
})
