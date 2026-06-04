import type React from 'react'

export default function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        fontSize: 9,
        letterSpacing: '0.25em',
        color: 'var(--tm)',
        textTransform: 'uppercase',
        marginBottom: 14,
        paddingBottom: 8,
        borderBottom: '1px solid var(--bs)',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}
