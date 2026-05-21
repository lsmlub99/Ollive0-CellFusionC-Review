interface Props {
  tag: string
}

export default function SectionDivider({ tag }: Props) {
  return (
    <div className="flex items-center gap-3 mb-1.5">
      <span className="h-px flex-1 bg-border" />
      <span className="font-label text-[10px] font-semibold tracking-[0.18em] uppercase text-text-secondary">
        {tag}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
