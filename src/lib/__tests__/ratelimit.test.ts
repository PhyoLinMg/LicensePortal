import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { allow, claimNonce, __resetForTesting } from '@/lib/ratelimit'

beforeEach(() => {
  __resetForTesting()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── allow ─────────────────────────────────────────────────────────────────────

describe('allow', () => {
  it('first request within limit returns true', () => {
    expect(allow('test:ip-a', 5, 60_000)).toBe(true)
  })

  it('requests up to the limit all return true', () => {
    for (let i = 0; i < 5; i++) {
      expect(allow('test:ip-b', 5, 60_000)).toBe(true)
    }
  })

  it('request exceeding the limit returns false', () => {
    for (let i = 0; i < 5; i++) allow('test:ip-c', 5, 60_000)
    expect(allow('test:ip-c', 5, 60_000)).toBe(false)
  })

  it('counter resets after windowMs elapses', () => {
    for (let i = 0; i < 5; i++) allow('test:ip-d', 5, 60_000)
    expect(allow('test:ip-d', 5, 60_000)).toBe(false)

    vi.advanceTimersByTime(60_001)

    expect(allow('test:ip-d', 5, 60_000)).toBe(true)
  })

  it('different keys have independent counters', () => {
    for (let i = 0; i < 5; i++) allow('test:ip-e', 5, 60_000)
    // exhausted ip-e, but ip-f is fresh
    expect(allow('test:ip-f', 5, 60_000)).toBe(true)
  })

  it('limit of 1 allows exactly one request', () => {
    expect(allow('strict:key', 1, 60_000)).toBe(true)
    expect(allow('strict:key', 1, 60_000)).toBe(false)
  })
})

// ── claimNonce ────────────────────────────────────────────────────────────────

describe('claimNonce', () => {
  it('first claim of a nonce returns true', () => {
    expect(claimNonce('hb', 'lic-1:nonce-abc')).toBe(true)
  })

  it('second claim of the same nonce returns false', () => {
    claimNonce('hb', 'lic-1:nonce-xyz')
    expect(claimNonce('hb', 'lic-1:nonce-xyz')).toBe(false)
  })

  it('same nonce string in different namespaces does not collide', () => {
    claimNonce('hb', 'shared-nonce')
    expect(claimNonce('validate', 'shared-nonce')).toBe(true)
  })

  it('nonce becomes reusable after NONCE_TTL_MS (10 min) elapses', () => {
    claimNonce('hb', 'lic-1:nonce-ttl')
    expect(claimNonce('hb', 'lic-1:nonce-ttl')).toBe(false)

    // Advance past the 10-minute TTL — claimNonce checks expiry inline
    vi.advanceTimersByTime(10 * 60_000 + 1)

    expect(claimNonce('hb', 'lic-1:nonce-ttl')).toBe(true)
  })

  it('different nonces for the same license are independent', () => {
    claimNonce('hb', 'lic-1:nonce-1')
    expect(claimNonce('hb', 'lic-1:nonce-2')).toBe(true)
  })
})
