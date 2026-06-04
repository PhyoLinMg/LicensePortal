export default function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--tm)', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: mono ? 10 : 12, color: 'var(--t2)', wordBreak: 'break-all', lineHeight: 1.5 }}>
        {value}
      </div>
    </div>
  )
}
