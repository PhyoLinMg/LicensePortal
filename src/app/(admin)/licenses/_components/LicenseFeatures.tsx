import Section from './Section'

export default function LicenseFeatures({ features }: { features: string[] }) {
  if (features.length === 0) return null
  return (
    <Section title="Features">
      <div className="flex gap-2 flex-wrap">
        {features.map(f => (
          <span key={f} className="text-[10px] tracking-[0.12em] fg-blue border border-[rgba(90,180,240,0.2)] px-2.5 py-0.5 uppercase">
            {f}
          </span>
        ))}
      </div>
    </Section>
  )
}
