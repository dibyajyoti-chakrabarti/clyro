const variantClasses = {
  primary:
    'border border-amber-300/80 bg-amber-400 text-black shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset] hover:border-amber-200 hover:bg-amber-300 hover:shadow-[0_10px_28px_rgba(251,191,36,0.22)] active:border-amber-400 active:bg-amber-500 active:shadow-none focus-visible:ring-amber-300 focus-visible:ring-offset-background',
  secondary:
    'border border-white/[0.18] bg-white/[0.03] text-text-primary shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset] hover:border-amber-300/55 hover:bg-amber-300/10 hover:text-amber-100 active:border-amber-400/45 active:bg-amber-400/15 focus-visible:ring-amber-300 focus-visible:ring-offset-background',
  ghost:
    'border border-transparent bg-transparent text-text-muted hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-text-primary active:bg-white/[0.07] focus-visible:ring-amber-300 focus-visible:ring-offset-background',
  danger:
    'border border-danger/70 bg-danger/10 text-danger hover:border-danger hover:bg-danger/15 hover:text-red-200 active:bg-danger/20 focus-visible:ring-danger focus-visible:ring-offset-background',
  link: 'min-h-0 border border-transparent bg-transparent px-0 py-0 text-accent hover:text-amber-300 hover:underline active:text-amber-500 focus-visible:ring-amber-300 focus-visible:ring-offset-background',
}

const sizeClasses = {
  sm: 'min-h-8 px-3.5 py-1.5 text-xs',
  md: 'min-h-10 px-5 py-2.5 text-sm',
  lg: 'min-h-12 px-6 py-3 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold leading-none tracking-normal transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45'

  return (
    <button
      type={type}
      className={`${base} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  )
}
