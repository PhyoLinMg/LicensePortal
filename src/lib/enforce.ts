import type { License } from '@prisma/client'
import { toRfc3339 } from './license'

export type EnforcementState = 'VALID' | 'EXPIRED' | 'REVOKED' | 'INVALID'

export interface EnforcementInfo {
  state: EnforcementState
  tier: string
  features: string[]
  limits: Record<string, number>
  expires_at: string
  grace_period_days: number
  heartbeat_url: string | null
}

export function computeState(license: Pick<License, 'status' | 'expiresAt'>): EnforcementState {
  if (license.status === 'revoked') return 'REVOKED'
  if (license.expiresAt < new Date()) return 'EXPIRED'
  return 'VALID'
}

export function buildEnforcementInfo(license: License): EnforcementInfo {
  return {
    state: computeState(license),
    tier: license.tier,
    features: license.features as string[],
    limits: license.limits as Record<string, number>,
    expires_at: toRfc3339(license.expiresAt),
    grace_period_days: license.gracePeriodDays,
    heartbeat_url: license.heartbeatUrl,
  }
}
