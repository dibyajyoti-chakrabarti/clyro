import { statusMeta } from '../../lib/projectStatus'

// Thin wrapper over the shared status module so every surface renders the same
// label + tint for a given project status.
export default function ProjectStatusBadge({ status = 'default', className = '' }) {
  const { label, badge } = statusMeta(status)

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${badge} ${className}`.trim()}
    >
      {label}
    </span>
  )
}
