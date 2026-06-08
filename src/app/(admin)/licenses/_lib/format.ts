export function fmtTs(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 19)
}

/** Returns a CSS class name for the dot and text colour of a license status. */
export function statusClass(s: string): string {
  if (s === 'active') return 'fg-green'
  if (s === 'revoked') return 'fg-red'
  return 'fg-orange'
}

/** Returns the border-left CSS class for a license row. */
export function statusBorderClass(s: string): string {
  if (s === 'active') return 'bdl-green'
  if (s === 'revoked') return 'bdl-red'
  return 'bdl-orange'
}

/** Returns a CSS class name for the staleness dot and text colour of an instance. */
export function stalenessClass(iso: string): string {
  const age = Date.now() - new Date(iso).getTime()
  if (age < 60 * 60 * 1000) return 'fg-green'
  if (age < 7 * 24 * 60 * 60 * 1000) return 'fg-orange'
  return 'fg-red'
}

export function tierLabel(t: string): string {
  return t.toUpperCase()
}

/** Maps audit event type to the .aud-* CSS class that sets --aud-fg/bg/bd vars. */
export const EVENT_TYPE_CLASS: Record<string, string> = {
  ISSUE:          'aud-issue',
  REVOKE:         'aud-revoke',
  RENEW:          'aud-renew',
  HEARTBEAT:      'aud-hb',
  HEARTBEAT_FAIL: 'aud-hb-fail',
  ADMIN_LOGIN:    'aud-admin',
  AUDIT_PRUNE:    'aud-hb',
  AUDIT_PRUNE_REJECTED: 'aud-hb-fail',
}

export function eventTypeClass(type: string): string {
  return EVENT_TYPE_CLASS[type] ?? 'aud-default'
}

/** Returns a CSS class name for colouring event type text in the event list. */
export const EVENT_CLASS: Record<string, string> = {
  ISSUE:          'fg-green',
  REVOKE:         'fg-red',
  RENEW:          'fg-blue',
  HEARTBEAT:      'fg-t2',
  HEARTBEAT_FAIL: 'fg-orange',
  ADMIN_LOGIN:    'fg-violet',
  AUDIT_PRUNE:    'fg-t2',
  AUDIT_PRUNE_REJECTED: 'fg-orange',
}
