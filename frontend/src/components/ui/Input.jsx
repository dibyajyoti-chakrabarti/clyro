export default function Input({
  label,
  placeholder,
  error,
  helperText,
  type = 'text',
  id,
  className = '',
  ...props
}) {
  const inputId = id || label.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      <label htmlFor={inputId} className='block text-sm font-medium text-text-primary'>
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        placeholder={placeholder}
        className={`w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm font-normal text-text-primary caret-accent placeholder:text-text-muted/60 transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:ring-offset-0 focus-visible:shadow-[0_0_0_4px_rgba(249,115,22,0.1)] ${error ? 'border-danger/60 focus-visible:border-danger/60 focus-visible:ring-danger/20' : 'border-white/[0.09] hover:border-white/[0.15]'}`}
        {...props}
      />
      {error ? (
        <p className='text-xs font-normal text-danger'>{error}</p>
      ) : helperText ? (
        <p className='text-xs font-normal text-text-muted'>{helperText}</p>
      ) : null}
    </div>
  )
}
