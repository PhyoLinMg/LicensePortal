'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

export type AuditRow = {
  id: string
  type: string
  payload: unknown
  createdAt: string
  licenseId: string | null
  customerName: string | null
  productName: string | null
}

const TYPE_CFG: Record<string, { label: string; fg: string; bg: string; border: string; accent: string }> = {
  ISSUE:          { label: 'ISSUE',   fg: '#3dd68c', bg: 'rgba(61,214,140,0.05)',  border: 'rgba(61,214,140,0.2)',  accent: '#3dd68c' },
  REVOKE:         { label: 'REVOKE',  fg: '#f06060', bg: 'rgba(240,96,96,0.05)',   border: 'rgba(240,96,96,0.2)',   accent: '#f06060' },
  RENEW:          { label: 'RENEW',   fg: '#5ab4f0', bg: 'rgba(90,180,240,0.05)',  border: 'rgba(90,180,240,0.2)',  accent: '#5ab4f0' },
  HEARTBEAT:      { label: 'HB',      fg: '#4a5578', bg: 'rgba(74,85,120,0.05)',   border: 'rgba(74,85,120,0.15)',  accent: '#4a5578' },
  HEARTBEAT_FAIL: { label: 'HB FAIL', fg: '#f09050', bg: 'rgba(240,144,80,0.05)',  border: 'rgba(240,144,80,0.2)',  accent: '#f09050' },
  ADMIN_LOGIN:    { label: 'ADMIN',   fg: '#a87af5', bg: 'rgba(168,122,245,0.05)', border: 'rgba(168,122,245,0.2)', accent: '#a87af5' },
}

function typeCfg(type: string) {
  return TYPE_CFG[type] ?? {
    label: type, fg: '#4a5578', bg: 'rgba(74,85,120,0.05)', border: 'rgba(74,85,120,0.15)', accent: '#4a5578',
  }
}

function fmtUtc(iso: string) {
  return { date: iso.slice(0, 10), time: iso.slice(11, 19) }
}

const FILTER_TYPES = ['ISSUE', 'REVOKE', 'RENEW', 'HEARTBEAT', 'HEARTBEAT_FAIL', 'ADMIN_LOGIN']

export default function AuditLogTable({ events }: { events: AuditRow[] }) {
  const [active, setActive] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const rows = useMemo(() => {
    let r = events
    if (active.size > 0) r = r.filter(e => active.has(e.type))
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(e =>
        e.customerName?.toLowerCase().includes(q) ||
        e.licenseId?.toLowerCase().includes(q) ||
        e.productName?.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q),
      )
    }
    return r
  }, [events, active, search])

  function toggleType(t: string) {
    setActive(prev => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n })
  }

  function toggleExp(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <>
      <style>{`
        .aud-row-btn:hover { background: var(--s1) !important; }
        .aud-search::placeholder { color: var(--tm); }
        .aud-search:focus { border-color: var(--b) !important; outline: none; }
      `}</style>

      <div style={{ padding: '20px 32px' }}>
        {/* Filter + search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {FILTER_TYPES.map(t => {
            const c = typeCfg(t)
            const on = active.has(t)
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  padding: '3px 9px',
                  border: `1px solid ${on ? c.border : 'var(--bs)'}`,
                  color: on ? c.fg : 'var(--tm)',
                  background: on ? c.bg : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                  textTransform: 'uppercase',
                }}
              >
                {c.label}
              </button>
            )
          })}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--tm)' }}>
              {rows.length}/{events.length}
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="customer · license · product"
              className="aud-search"
              style={{
                fontFamily: 'inherit',
                background: 'transparent',
                border: '1px solid var(--bs)',
                padding: '5px 12px',
                fontSize: 11,
                color: 'var(--t2)',
                width: 240,
                transition: 'border-color 0.15s',
              }}
            />
          </div>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '88px 150px 1fr 120px 20px',
          padding: '4px 12px',
          fontSize: 9,
          letterSpacing: '0.2em',
          color: 'var(--tm)',
          borderBottom: '1px solid var(--bs)',
          marginBottom: 2,
          textTransform: 'uppercase',
        }}>
          <span>Type</span>
          <span>Timestamp UTC</span>
          <span>License · Customer</span>
          <span>Product</span>
          <span />
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', fontSize: 10, color: 'var(--tm)', letterSpacing: '0.25em' }}>
            — NO EVENTS MATCH —
          </div>
        ) : (
          rows.map((e, i) => {
            const c = typeCfg(e.type)
            const { date, time } = fmtUtc(e.createdAt)
            const isExp = expanded.has(e.id)

            return (
              <div
                key={e.id}
                style={{ animationDelay: `${Math.min(i * 15, 300)}ms`, animation: 'slideRight 0.2s ease both' }}
              >
                <button
                  onClick={() => toggleExp(e.id)}
                  className="aud-row-btn"
                  style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '88px 150px 1fr 120px 20px',
                    padding: '8px 12px',
                    borderLeft: `2px solid ${isExp ? c.accent : 'transparent'}`,
                    borderBottom: '1px solid var(--bs)',
                    background: isExp ? c.bg : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.1s, border-left-color 0.1s',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    alignItems: 'center',
                  }}
                  onMouseEnter={el => { if (!isExp) el.currentTarget.style.borderLeftColor = c.accent + '60' }}
                  onMouseLeave={el => { if (!isExp) el.currentTarget.style.borderLeftColor = 'transparent' }}
                >
                  {/* Badge */}
                  <div>
                    <span style={{
                      display: 'inline-block',
                      fontSize: 8,
                      fontWeight: 600,
                      letterSpacing: '0.15em',
                      padding: '2px 6px',
                      border: `1px solid ${c.border}`,
                      color: c.fg,
                      background: c.bg,
                      fontFamily: 'inherit',
                      textTransform: 'uppercase',
                    }}>
                      {c.label}
                    </span>
                  </div>

                  {/* Timestamp */}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--t2)' }}>{date}</div>
                    <div style={{ fontSize: 9, color: 'var(--tm)' }}>{time}</div>
                  </div>

                  {/* License + customer */}
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                      {e.licenseId ? (
                        <><span>{e.licenseId.slice(0, 8)}</span><span style={{ color: 'var(--tm)' }}>…</span></>
                      ) : '—'}
                    </div>
                    {e.customerName && (
                      <div style={{ fontSize: 9, color: 'var(--tm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.customerName}
                      </div>
                    )}
                  </div>

                  {/* Product */}
                  <div style={{ fontSize: 10, color: 'var(--tm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.productName ?? '—'}
                  </div>

                  {/* Expand */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{
                      fontSize: 13,
                      color: 'var(--tm)',
                      display: 'inline-block',
                      transform: isExp ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.15s',
                      lineHeight: 1,
                    }}>›</span>
                  </div>
                </button>

                {isExp && (
                  <div style={{ padding: '0 12px 10px 14px' }}>
                    <div style={{
                      border: `1px solid ${c.border}`,
                      background: c.bg,
                      padding: '10px 14px',
                    }}>
                      <pre style={{
                        fontSize: 11,
                        lineHeight: 1.75,
                        color: c.fg,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        margin: 0,
                        fontFamily: 'inherit',
                      }}>
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                      <div style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: `1px solid ${c.border}`,
                        fontSize: 9,
                        letterSpacing: '0.1em',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontFamily: 'inherit',
                      }}>
                        <span style={{ color: c.fg, opacity: 0.4 }}>evt/{e.id}</span>
                        {e.licenseId && (
                          <Link
                            href={`/licenses/${e.licenseId}`}
                            style={{ color: c.fg, opacity: 0.6, textDecoration: 'none', fontSize: 9 }}
                            onClick={ev => ev.stopPropagation()}
                          >
                            → view license
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}

        <div style={{ padding: '14px 0', textAlign: 'center', fontSize: 9, color: 'var(--tm)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
          Immutable · Append-Only · {events.length} Total Records
        </div>
      </div>
    </>
  )
}
