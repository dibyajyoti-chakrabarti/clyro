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
    <div className={`space-y-1 ${className}`.trim()}>
      <label htmlFor={inputId} className='text-sm font-medium text-text-primary'>
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        placeholder={placeholder}
        className='w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-normal text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background'
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
