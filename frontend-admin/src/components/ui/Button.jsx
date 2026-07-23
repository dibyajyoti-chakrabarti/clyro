const variantClasses = {
  primary:
    'border border-amber-300/70 bg-gradient-to-b from-amber-400 to-amber-500 text-black shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_-1px_0_0_rgba(0,0,0,0.2)_inset] hover:from-amber-300 hover:to-amber-400 hover:shadow-[0_0_20px_rgba(249,115,22,0.3),0_1px_0_0_rgba(255,255,255,0.18)_inset] active:from-amber-500 active:to-amber-600 active:shadow-[0_0_0_0_transparent,0_1px_2px_rgba(0,0,0,0.3)_inset] focus-visible:ring-amber-400 focus-visible:ring-offset-background',
  secondary:
    'border border-white/[0.10] bg-white/[0.04] text-text-primary shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset] hover:border-amber-400/40 hover:bg-accent/8 hover:text-amber-100 hover:shadow-[0_0_12px_rgba(249,115,22,0.12),0_1px_0_0_rgba(255,255,255,0.06)_inset] active:bg-accent/12 focus-visible:ring-amber-400 focus-visible:ring-offset-background',
  ghost:
    'border border-transparent bg-transparent text-text-muted hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-text-primary active:bg-white/[0.07] focus-visible:ring-amber-400 focus-visible:ring-offset-background',
  danger:
    'border border-danger/50 bg-danger/8 text-danger shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] hover:border-danger/80 hover:bg-danger/15 hover:text-red-300 hover:shadow-[0_0_12px_rgba(239,68,68,0.15)] active:bg-danger/20 focus-visible:ring-danger focus-visible:ring-offset-background',
  link: 'min-h-0 border border-transparent bg-transparent px-0 py-0 text-accent hover:text-amber-300 hover:underline underline-offset-4 active:text-amber-500 focus-visible:ring-amber-400 focus-visible:ring-offset-background',
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
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold leading-none tracking-normal transition-all duration-100 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <button
      type={type}
      className={`${base} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  )
}
