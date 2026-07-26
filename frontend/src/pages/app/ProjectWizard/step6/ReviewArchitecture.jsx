import {
  ArrowRight, Box, ChevronDown, Clock,
  CreditCard, LayoutGrid, MousePointerClick, Pencil,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import billIll from '../../../../assets/steps/step6/bill_ill.webp'
import confirmProvisionIll from '../../../../assets/steps/step6/confirm_provision_ill.webp'
import Button from '../../../../components/ui/Button'
import { buildCfnBom } from '../../../../utils/cfnBom'
import { DEFAULT_CHIP_CLASS, SERVICE_ICON_MAP } from './serviceIcons'

function StatCard({ icon: Icon, value, label }) {
  return (
    <div className='flex min-w-0 items-center gap-3.5 rounded-xl border border-[#F5B942]/30 bg-[#1a1d23] px-5 py-4 lg:gap-4 lg:px-6 lg:py-5'>
      <Icon className='h-6 w-6 shrink-0 text-[#F5B942] lg:h-7 lg:w-7' />
      <div className='min-w-0'>
        <p className='truncate text-base font-semibold text-text-primary lg:text-lg'>{value}</p>
        {/* Not truncated: equal-width grid columns are narrower than these labels at
            some widths, so they wrap instead of being clipped mid-word. */}
        <p className='text-xs leading-snug text-text-muted lg:text-sm'>{label}</p>
      </div>
    </div>
  )
}

function ResourceCategoryCard({ group, open, onToggle, onClose }) {
  const { icon: Icon, chipClass } = SERVICE_ICON_MAP[group.namespace] || {}
  const count = group.items.reduce((sum, item) => sum + item.count, 0)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 })

  const computePos = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const width = Math.max(rect.width, 220)
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12)
    setPanelPos({ top: rect.bottom + 6, left, width })
  }

  const handleTriggerClick = () => {
    if (!open) computePos()
    onToggle()
  }

  // Close on outside click, or if the page scrolls/resizes underneath the
  // portaled panel (its fixed position would otherwise drift from the card).
  useEffect(() => {
    if (!open) return
    const handleOutside = (e) => {
      const inTrigger = triggerRef.current?.contains(e.target)
      const inPanel = panelRef.current?.contains(e.target)
      if (!inTrigger && !inPanel) onClose()
    }
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [open, onClose])

  const previewLabel = group.items[0]?.label

  return (
    <div className='rounded-xl border border-white/[0.08] bg-[#1a1d23]'>
      <button
        ref={triggerRef}
        type='button'
        onClick={handleTriggerClick}
        className='flex w-full items-center gap-3.5 px-4 py-3.5 text-left lg:gap-4 lg:px-5 lg:py-4'
      >
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] lg:h-12 lg:w-12 ${chipClass || DEFAULT_CHIP_CLASS}`}>
          {Icon ? <img src={Icon} alt='' className='h-7 w-7 lg:h-8 lg:w-8' /> : <Box className='h-6 w-6 lg:h-7 lg:w-7' />}
        </span>
        <span className='min-w-0 flex-1'>
          <span className='block text-sm font-semibold leading-snug text-white lg:text-[15px]'>{group.service}</span>
          {previewLabel ? <span className='block truncate text-xs text-[#9CA3AF] lg:text-[13px]'>{previewLabel}</span> : null}
        </span>
        <span className='flex shrink-0 items-center gap-1.5 text-text-muted'>
          {count > 1 ? <span className='text-xs lg:text-sm'>×{count}</span> : null}
          <ChevronDown className={`h-4.5 w-4.5 text-[#F5B942] transition-transform duration-150 lg:h-5 lg:w-5 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open ? createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: panelPos.top, left: panelPos.left, width: panelPos.width, zIndex: 9999 }}
          className='rounded-lg border border-[#F5B942]/40 bg-[#1a1d23] p-3.5 shadow-xl shadow-black/40'
        >
          <ul className='space-y-2'>
            {group.items.map((item) => (
              <li key={item.type} className='flex items-center justify-between gap-4 text-sm text-text-muted'>
                <span title={item.names.join(', ')} className='truncate'>{item.label}</span>
                {item.count > 1 ? <span className='shrink-0'>×{item.count}</span> : null}
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

function ReviewArchitecture({ cfTemplate, onEditArchitecture, onProvision }) {
  const bom = useMemo(() => buildCfnBom(cfTemplate), [cfTemplate])
  const categoryCount = bom?.groups.length ?? 0
  const [expandedCategory, setExpandedCategory] = useState(null)

  return (
    <div className='mx-auto w-full max-w-6xl'>
      <div className='flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center'>
        <div className='min-w-0'>
          {/* clamp() + nowrap keeps "Review & provision" on exactly one line at every
              width — it scales down with the viewport instead of ever wrapping. */}
          <h1 className='whitespace-nowrap text-[clamp(1.75rem,5vw,4.25rem)] font-bold leading-tight'>
            <span className='relative inline-block text-white'>
              Review &amp;
              <span className='absolute -bottom-2 left-0 h-1.5 w-full rounded-full bg-[#F5B942]' />
            </span>{' '}
            <span className='text-[#F5B942]'>provision</span>
          </h1>
          <p className='mt-6 text-base text-text-muted lg:text-lg'>
            Here&apos;s everything Clyro will create in your AWS account.
            <br />
            Review the resources below and provision when you&apos;re ready.
          </p>
        </div>
        {/* Not shrink-0: the illustration gives up width first so the heading never
            has to compress or overflow. */}
        <img src={confirmProvisionIll} alt='' className='hidden h-auto w-80 min-w-0 sm:block lg:w-[26rem]' />
      </div>

      <div className='mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
        <StatCard icon={Box} value={bom?.total ?? 0} label='AWS Resources' />
        <StatCard icon={LayoutGrid} value={categoryCount} label='Resource Categories' />
        <StatCard icon={MousePointerClick} value='0' label='Manual Actions' />
        <StatCard icon={CreditCard} value='Charges apply' label='AWS will bill your account' />
        <StatCard icon={Clock} value='~10-15 min' label='Est. Time Taken' />
      </div>

      <div className='mt-8 w-full rounded-2xl border border-[#F5B942]/30 bg-[#14171c] p-6 lg:p-8'>
        <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-3'>
          <div className='flex items-center gap-3'>
            <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5B942]/15 lg:h-11 lg:w-11'>
              <Box className='h-5 w-5 text-[#F5B942] lg:h-[22px] lg:w-[22px]' />
            </span>
            <h3 className='text-base font-bold text-[#F5B942] sm:text-lg lg:text-xl'>What Clyro will create</h3>
          </div>
          <span className='shrink-0 rounded-full border border-white/[0.08] px-3.5 py-1.5 text-sm text-text-muted'>
            {bom?.total ?? 0} AWS resources
          </span>
        </div>

        {bom ? (
          <div className='mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5'>
            {bom.groups.map((group) => (
              <ResourceCategoryCard
                key={group.service}
                group={group}
                open={expandedCategory === group.service}
                onToggle={() => setExpandedCategory((prev) => (prev === group.service ? null : group.service))}
                onClose={() => setExpandedCategory(null)}
              />
            ))}
          </div>
        ) : (
          <p className='mt-6 text-base text-text-muted'>No resources found in the generated template.</p>
        )}
      </div>

      <div className='mt-10'>
        <img src={billIll} alt='' className='block h-auto w-full' />
        {/* Below ~420px the two buttons can't sit side by side without overflowing,
            so they stack full-width; above that it's the far-left / far-right row. */}
        <div className='mt-10 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between'>
          <Button
            variant='secondary'
            size='lg'
            onClick={onEditArchitecture}
            className='w-full !border-[#F5B942]/60 !bg-transparent !text-[#F5B942] hover:!border-[#F5B942] hover:!bg-[#F5B942]/10 hover:!text-[#F7C565] min-[420px]:w-auto'
          >
            <Pencil className='h-5 w-5' />
            Edit template
          </Button>
          <Button
            variant='primary'
            size='lg'
            onClick={onProvision}
            className='w-full !border-[#F5B942]/70 !bg-none !bg-[#F5B942] !text-black hover:!bg-[#F7C565] active:!bg-[#E0A73A] min-[420px]:w-auto'
          >
            Provision
            <ArrowRight className='h-5 w-5' />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ReviewArchitecture
