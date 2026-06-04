import type React from 'react'

export const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--b)',
  padding: '6px 0 8px',
  fontSize: 13,
  color: 'var(--t1)',
  fontFamily: 'inherit',
}

export const lblStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 9,
  letterSpacing: '0.25em',
  color: 'var(--tm)',
  marginBottom: 10,
  textTransform: 'uppercase',
}

export const primBtnStyle: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 10,
  letterSpacing: '0.2em',
  fontWeight: 600,
  color: '#07080d',
  background: 'var(--amber)',
  border: 'none',
  padding: '9px 16px',
  cursor: 'pointer',
  textTransform: 'uppercase',
  transition: 'background 0.12s',
}

export const secBtnStyle: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 10,
  letterSpacing: '0.18em',
  color: 'var(--t2)',
  background: 'none',
  border: '1px solid var(--b)',
  padding: '9px 14px',
  cursor: 'pointer',
  textTransform: 'uppercase',
  transition: 'border-color 0.1s, color 0.1s',
}

export const cancelBtnStyle: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 10,
  letterSpacing: '0.15em',
  color: 'var(--tm)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textTransform: 'uppercase',
  transition: 'color 0.1s',
}
