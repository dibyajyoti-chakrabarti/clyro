import { ChevronDown } from 'lucide-react'

// Dark-theme native <select> styled to match Input.jsx. Keeps native semantics
// (keyboard, mobile pickers) while fixing the white-on-dark dropdowns the wizard
// previously used. `options` is [{ value, label }]; children may be passed instead.
export default function Select({
  label,
  id,
  error,
  helperText,
  options,
  placeholder,
  className = '',
  selectClassName = '',
  children,
  ...props
}) {
  const selectId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-') : undefined)

  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      {label ? (
        <label htmlFor={selectId} className='block text-sm font-medium text-text-primary'>
          {label}
        </label>
      ) : null}
      <div className='relative'>
        <select
          id={selectId}
          className={`w-full appearance-none rounded-lg border bg-surface px-3.5 py-2.5 pr-10 text-sm font-normal text-text-primary transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-danger/60' : 'border-white/[0.09] hover:border-white/[0.15]'} ${selectClassName}`.trim()}
          {...props}
        >
          {placeholder !== undefined ? (
            <option value=''>{placeholder}</option>
          ) : null}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted' />
      </div>
      {error ? (
        <p className='text-xs font-normal text-danger'>{error}</p>
      ) : helperText ? (
        <p className='text-xs font-normal text-text-muted'>{helperText}</p>
      ) : null}
    </div>
  )
}
