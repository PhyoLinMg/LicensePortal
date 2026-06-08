import Section from './Section'

export default function LicenseLimits({ limits }: { limits: Record<string, number> }) {
  if (Object.keys(limits).length === 0) return null
  return (
    <Section title="Limits">
      <div className="flex gap-4 flex-wrap">
        {Object.entries(limits).map(([k, v]) => (
          <div key={k} className="bd px-4 py-2.5 min-w-[100px]">
            <div className="text-[9px] tracking-[0.15em] fg-muted mb-1 uppercase">
              {k.replace(/_/g, ' ')}
            </div>
            <div className="text-[22px] font-semibold fg-amber tracking-[-0.03em]">
              {v}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
