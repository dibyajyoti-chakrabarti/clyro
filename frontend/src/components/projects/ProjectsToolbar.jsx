import { useEffect, useRef, useState } from 'react'
import { ArrowUpDown, ChevronDown, Search, SlidersHorizontal } from 'lucide-react'

const filterOptions = ['All', 'Active', 'Completed']
const sortOptions = ['Newest', 'Oldest', 'Name']

export default function ProjectsToolbar({
  search,
  onSearchChange,
  filter = 'All',
  sort = 'Newest',
  onFilterChange,
  onSortChange,
  onClearSearch,
}) {
  const [openMenu, setOpenMenu] = useState(null)
  const [renderedMenu, setRenderedMenu] = useState(null)
  const filterRef = useRef(null)
  const sortRef = useRef(null)

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target
      const clickedFilter = filterRef.current?.contains(target)
      const clickedSort = sortRef.current?.contains(target)

      if (!clickedFilter && !clickedSort) {
        setOpenMenu(null)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpenMenu(null)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    if (openMenu) {
      setRenderedMenu(openMenu)
      return
    }

    const timeout = window.setTimeout(() => {
      setRenderedMenu(null)
    }, 180)

    return () => window.clearTimeout(timeout)
  }, [openMenu])

  const renderDropdown = ({ label, value, options, onChange, icon: Icon, ref, name }) => (
    <div className='relative' ref={ref}>
      <button
        type='button'
        aria-haspopup='listbox'
        aria-expanded={openMenu === name}
        onClick={() => setOpenMenu((current) => (current === name ? null : name))}
        className='group flex h-[40px] w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-left text-sm text-white backdrop-blur-md outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-[#FFC400]/20 hover:bg-white/[0.06] focus:border-[#FFC400] focus:shadow-[0_0_0_3px_rgba(255,196,0,0.12)]'
      >
        <Icon className='h-4 w-4 shrink-0 text-white/75 transition-colors duration-150 group-hover:text-[#FFC400]' />
        <span className='min-w-0 flex-1 truncate text-sm text-white'>{value}</span>
        <ChevronDown className='h-4 w-4 shrink-0 text-white/75 transition-colors duration-150 group-hover:text-[#FFC400]' />
      </button>

      {renderedMenu === name ? (
        <div
          className={`absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[16px] border border-white/[0.08] bg-[rgba(10,15,26,0.72)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-[20px] transition-all duration-[180ms] ease-out ${
            openMenu === name ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
          }`}
        >
          <div role='listbox' aria-label={label}>
            {options.map((option, index) => {
              const selected = option === value
              const isLast = index === options.length - 1
              return (
                <button
                  key={option}
                  type='button'
                  role='option'
                  aria-selected={selected}
                  onClick={() => {
                    onChange?.(option)
                    setOpenMenu(null)
                  }}
                  className={`flex w-full cursor-pointer items-center px-4 py-3 text-sm font-medium text-[rgba(255,255,255,0.92)] transition-[background-color,color,font-weight] duration-150 ease-out ${
                    selected
                      ? 'bg-[rgba(255,196,0,0.16)] font-semibold text-[#FFC400]'
                      : 'hover:bg-[rgba(255,196,0,0.10)] hover:text-[#FFC400]'
                  } ${!isLast ? 'border-b border-white/[0.05]' : ''}`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )

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
          {renderDropdown({
            label: 'Filter projects',
            value: filter,
            options: filterOptions,
            onChange: onFilterChange,
            icon: SlidersHorizontal,
            ref: filterRef,
            name: 'filter',
          })}
        </label>
        <label className='flex min-w-0 flex-1 flex-col gap-2'>
          <span className='text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted'>Sort</span>
          {renderDropdown({
            label: 'Sort projects',
            value: sort,
            options: sortOptions,
            onChange: onSortChange,
            icon: ArrowUpDown,
            ref: sortRef,
            name: 'sort',
          })}
        </label>
      </div>
    </div>
  )
}
