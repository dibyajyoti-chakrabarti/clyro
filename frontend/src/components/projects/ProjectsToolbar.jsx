function ToolbarSelect({ label, value, options, onChange }) {
  return (
    <label className='flex min-w-0 flex-1 flex-col gap-2'>
      <span className='text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted'>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className='h-10 rounded-xl border border-white/[0.08] bg-background/70 px-3 text-sm text-text-primary outline-none transition-colors focus:border-amber-400/40'
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

export default function ProjectsToolbar({
  search,
  onSearchChange,
  filter = 'All',
  sort = 'Newest',
  onFilterChange,
  onSortChange,
  onClearSearch,
}) {
  return (
    <div className='flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-surface/40 p-4 backdrop-blur-md lg:flex-row lg:items-end lg:justify-between'>
      <label className='flex min-w-0 flex-1 flex-col gap-2'>
        <span className='text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted'>Search</span>
        <div className='flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-background/70 px-3 transition-[border-color,box-shadow] duration-150 focus-within:border-amber-400/40 focus-within:shadow-[0_0_0_3px_rgba(251,191,36,0.08)]'>
          <i className='ti ti-search text-sm text-text-muted' />
          <input
            className='min-w-0 flex-1 bg-transparent text-sm text-text-primary caret-amber-400 placeholder:text-text-muted/60 outline-none'
            placeholder='Search by project name...'
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
          {search ? (
            <button type='button' onClick={onClearSearch} className='text-text-muted transition-colors hover:text-text-primary'>
              <i className='ti ti-x text-xs' />
            </button>
          ) : null}
        </div>
      </label>

      <div className='grid gap-3 sm:grid-cols-2 lg:w-[420px]'>
        <ToolbarSelect label='Filter' value={filter} options={['All', 'Active', 'Completed']} onChange={onFilterChange} />
        <ToolbarSelect label='Sort' value={sort} options={['Newest', 'Oldest', 'Name']} onChange={onSortChange} />
      </div>
    </div>
  )
}
