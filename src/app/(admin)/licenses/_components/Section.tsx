import type React from 'react'

export default function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <div className="text-[9px] tracking-[0.25em] fg-muted uppercase mb-3.5 pb-2 bdb">
        {title}
      </div>
      {children}
    </div>
  )
}
