import { ArrowUpDown, Search, SlidersHorizontal } from 'lucide-react'

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
          <Search className='h-4 w-4 text-text-muted' />
          <input
            className='min-w-0 flex-1 bg-transparent text-sm text-text-primary caret-amber-400 placeholder:text-text-muted/60 outline-none'
            placeholder='Search by project name...'
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
          {search ? (
            <button type='button' onClick={onClearSearch} className='text-text-muted transition-colors hover:text-text-primary'>
              <span aria-hidden='true' className='text-sm leading-none'>×</span>
            </button>
          ) : null}
        </div>
      </label>

      <div className='grid gap-3 sm:grid-cols-2 lg:w-[420px]'>
        <label className='flex min-w-0 flex-1 flex-col gap-2'>
          <span className='text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted'>Filter</span>
          <div className='flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-background/70 px-3'>
            <SlidersHorizontal className='h-4 w-4 text-text-muted' />
            <select
              value={filter}
              onChange={(e) => onFilterChange?.(e.target.value)}
              className='min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none'
            >
              {['All', 'Active', 'Completed'].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </label>
        <label className='flex min-w-0 flex-1 flex-col gap-2'>
          <span className='text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted'>Sort</span>
          <div className='flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-background/70 px-3'>
            <ArrowUpDown className='h-4 w-4 text-text-muted' />
            <select
              value={sort}
              onChange={(e) => onSortChange?.(e.target.value)}
              className='min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none'
            >
              {['Newest', 'Oldest', 'Name'].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </label>
      </div>
    </div>
  )
}
