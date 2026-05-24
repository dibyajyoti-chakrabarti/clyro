const badgeVariants = {
  success: 'bg-success/15 text-success border border-success/40',
  warning: 'bg-accent-soft text-accent border border-accent/40',
  danger: 'bg-danger/10 text-danger border border-danger/40',
  neutral: 'bg-surface text-text-muted border border-border',
}

export default function Badge({ variant = 'neutral', children, className = '' }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${badgeVariants[variant]} ${className}`.trim()}>
      {children}
    </span>
  )
}
