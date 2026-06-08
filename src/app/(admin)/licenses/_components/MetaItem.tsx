export default function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9px] tracking-[0.18em] fg-muted uppercase mb-1">
        {label}
      </div>
      <div className={`${mono ? 'text-[10px]' : 'text-xs'} fg-t2 break-all leading-[1.5]`}>
        {value}
      </div>
    </div>
  )
}
