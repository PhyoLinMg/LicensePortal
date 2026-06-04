import Section from './Section'

export default function LicenseLimits({ limits }: { limits: Record<string, number> }) {
  if (Object.keys(limits).length === 0) return null
  return (
    <Section title="Limits">
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {Object.entries(limits).map(([k, v]) => (
          <div key={k} style={{ border: '1px solid var(--bs)', padding: '10px 16px', minWidth: 100 }}>
            <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--tm)', marginBottom: 4, textTransform: 'uppercase' }}>
              {k.replace(/_/g, ' ')}
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--amber)', letterSpacing: '-0.03em' }}>
              {v}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
