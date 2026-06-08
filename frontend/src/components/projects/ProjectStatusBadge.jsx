const STATUS_STYLES = {
  production: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  development: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  staging: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
  live: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  failed: 'border-red-400/25 bg-red-400/10 text-red-200',
  default: 'border-white/[0.08] bg-white/[0.04] text-text-muted',
}

const STATUS_LABELS = {
  production: 'Production',
  development: 'Development',
  staging: 'Staging',
  live: 'Live',
  failed: 'Failed',
}

export default function ProjectStatusBadge({ status = 'default', className = '' }) {
  const key = String(status).toLowerCase()
  const resolved = STATUS_STYLES[key] ? key : 'default'

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${STATUS_STYLES[resolved]} ${className}`.trim()}
    >
      {STATUS_LABELS[resolved] ?? status}
    </span>
  )
}
