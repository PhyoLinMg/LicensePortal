export function fmtTs(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 19)
}

export function statusColor(s: string): string {
  if (s === 'active') return 'var(--green)'
  if (s === 'revoked') return 'var(--red)'
  return 'var(--orange)'
}

export function staleness(iso: string): string {
  const age = Date.now() - new Date(iso).getTime()
  if (age < 60 * 60 * 1000) return 'var(--green)'
  if (age < 7 * 24 * 60 * 60 * 1000) return 'var(--orange)'
  return 'var(--red)'
}

export function tierLabel(t: string): string {
  return t.toUpperCase()
}

export const EVENT_COLOR: Record<string, string> = {
  ISSUE:          'var(--green)',
  REVOKE:         'var(--red)',
  RENEW:          'var(--blue)',
  HEARTBEAT:      'var(--t2)',
  HEARTBEAT_FAIL: 'var(--orange)',
  ADMIN_LOGIN:    'var(--violet)',
}
