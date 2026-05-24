const variantClasses = {
  primary:
    'bg-accent text-text-primary hover:brightness-110 active:brightness-95 border border-transparent focus-visible:ring-accent focus-visible:ring-offset-background',
  secondary:
    'bg-surface border border-border text-accent hover:bg-accent-soft active:brightness-95 focus-visible:ring-accent focus-visible:ring-offset-background',
  ghost:
    'bg-transparent border border-transparent text-text-muted hover:bg-surface hover:text-text-primary active:brightness-95 focus-visible:ring-accent focus-visible:ring-offset-background',
  danger:
    'bg-transparent border border-danger text-danger hover:bg-danger/10 active:brightness-95 focus-visible:ring-danger focus-visible:ring-offset-background',
  link: 'bg-transparent border border-transparent text-accent px-0 py-0 hover:underline focus-visible:ring-accent focus-visible:ring-offset-background',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-sm',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <button
      type={type}
      className={`${base} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  )
}
