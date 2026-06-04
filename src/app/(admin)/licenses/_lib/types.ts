export interface LicenseInstance {
  id: string
  instanceUuid: string
  lastSeenAt: string
  firstSeenAt: string
  lastVersion: string | null
  lastUsage: Record<string, number> | null
  latestSequence: string
}

export interface AuditEvent {
  id: string
  type: string
  payload: unknown
  createdAt: string
}

export interface License {
  id: string
  status: string
  tier: string
  features: string[]
  limits: Record<string, number>
  issuedAt: string
  expiresAt: string
  gracePeriodDays: number
  heartbeatUrl: string | null
  licenseText: string
  revokedAt: string | null
  revokeReason: string | null
  customer: { id: string; name: string; email: string | null }
  product: { id: string; name: string; slug: string; keyId: string }
  instances: LicenseInstance[]
  auditEvents: AuditEvent[]
}
