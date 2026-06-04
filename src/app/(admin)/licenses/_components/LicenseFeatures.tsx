import Section from './Section'

export default function LicenseFeatures({ features }: { features: string[] }) {
  if (features.length === 0) return null
  return (
    <Section title="Features">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {features.map(f => (
          <span key={f} style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--blue)',
            border: '1px solid rgba(90,180,240,0.2)',
            padding: '3px 10px',
            textTransform: 'uppercase',
          }}>
            {f}
          </span>
        ))}
      </div>
    </Section>
  )
}
