import {
  AlertTriangle, ArrowRight, Box, ChevronDown, Clock,
  CreditCard, LayoutGrid, MousePointerClick, Pencil,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import confirmProvisionIll from '../../../../assets/steps/step6/confirm_provision_ill.webp'
import Button from '../../../../components/ui/Button'
import { ScallopedPanel } from '../../../../components/ui/ScallopedPanel'
import { buildCfnBom } from '../../../../utils/cfnBom'
import { DEFAULT_CHIP_CLASS, SERVICE_ICON_MAP } from './serviceIcons'

function StatCard({ icon: Icon, value, label }) {
  return (
    <div className='flex flex-1 items-center gap-3 rounded-xl border border-[#E9B949]/40 bg-white/[0.02] px-4 py-3'>
      <Icon className='h-5 w-5 shrink-0 text-[#E9B949]' />
      <div className='min-w-0'>
        <p className='truncate text-sm font-semibold text-text-primary'>{value}</p>
        <p className='truncate text-xs text-text-muted'>{label}</p>
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

  return (
    <div className='rounded-[9px] border border-white/[0.06] bg-[#1a1d23]'>
      <button
        ref={triggerRef}
        type='button'
        onClick={handleTriggerClick}
        className='flex w-full items-center gap-2 px-2 py-2 text-left'
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ${chipClass || DEFAULT_CHIP_CLASS}`}>
          {Icon ? <img src={Icon} alt='' className='h-4 w-4' /> : <Box className='h-3.5 w-3.5' />}
        </span>
        <span className='min-w-0 flex-1'>
          <span className='block text-[12px] font-semibold leading-snug text-text-primary'>{group.service}</span>
          <span className='block text-[10px] text-text-muted'>aws</span>
        </span>
        <span className='flex shrink-0 items-center gap-1 text-text-muted'>
          {count > 1 ? <span className='text-[11px]'>×{count}</span> : null}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open ? createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: panelPos.top, left: panelPos.left, width: panelPos.width, zIndex: 9999 }}
          className='rounded-lg border border-[#E9B949]/40 bg-[#1a1d23] p-3 shadow-xl shadow-black/40'
        >
          <ul className='space-y-1.5'>
            {group.items.map((item) => (
              <li key={item.type} className='flex items-center justify-between gap-4 text-xs text-text-muted'>
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

function ReviewArchitecture({ showTemplate, cfTemplate, onToggleTemplate, onEditArchitecture, onProvision }) {
  const bom = useMemo(() => buildCfnBom(cfTemplate), [cfTemplate])
  const categoryCount = bom?.groups.length ?? 0
  const [expandedCategory, setExpandedCategory] = useState(null)

  return (
    <div className='mx-auto w-full max-w-6xl'>
      <div className='flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center'>
        <div>
          <h1 className='bg-gradient-to-r from-white via-[#FFD700] to-[#E9B949] bg-clip-text text-[40px] font-bold leading-tight text-transparent sm:text-[52px]'>
            <span className='relative inline-block'>
              Review
              <span className='absolute -bottom-1.5 left-0 h-1 w-16 rounded-full bg-[#E9B949]' />
            </span>{' '}
            &amp; provision
          </h1>
          <p className='mt-4 text-sm text-text-muted'>
            Here&apos;s everything Clyro will create in your AWS account.
            <br />
            Review the resources below and provision when you&apos;re ready.
          </p>
        </div>
        <img src={confirmProvisionIll} alt='' className='hidden w-72 shrink-0 sm:block lg:w-80' />
      </div>

      <div className='mt-8 flex flex-col gap-3 sm:flex-row'>
        <StatCard icon={Box} value={bom?.total ?? 0} label='AWS Resources' />
        <StatCard icon={LayoutGrid} value={categoryCount} label='Resource Categories' />
        <StatCard icon={MousePointerClick} value='0' label='Manual Actions' />
        <StatCard icon={CreditCard} value='Charges apply' label='AWS will bill your account' />
        <StatCard icon={Clock} value='~10-15 min' label='Est. Time Taken' />
      </div>

      <ScallopedPanel className='mt-6 w-full' contentClassName='p-5'>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex items-center gap-2'>
            <span className='flex h-7 w-7 items-center justify-center rounded-full bg-[#E9B949]/15'>
              <Box className='h-3.5 w-3.5 text-[#E9B949]' />
            </span>
            <h3 className='text-sm font-bold text-[#E9B949]'>What Clyro will create</h3>
          </div>
          <span className='shrink-0 rounded-full border border-white/[0.08] px-2.5 py-1 text-xs text-text-muted'>
            {bom?.total ?? 0} AWS resources
          </span>
        </div>

        {bom ? (
          <div className='mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3'>
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
          <p className='mt-3 text-sm text-text-muted'>No resources found in the generated template.</p>
        )}

        <div className='mt-5'>
          <button type='button' className='text-sm font-medium text-[#E9B949] hover:underline' onClick={onToggleTemplate}>
            {showTemplate ? 'Hide CloudFormation template' : 'View CloudFormation template'}
          </button>
          {showTemplate ? (
            <pre className='mt-3 max-h-48 overflow-y-auto rounded-md border border-border bg-background p-3 text-xs text-text-muted'>
              {cfTemplate}
            </pre>
          ) : null}
        </div>
      </ScallopedPanel>

      <div className='mt-6 flex flex-col items-stretch justify-between gap-4 lg:flex-row lg:items-center'>
        <p className='flex items-start gap-2 rounded-lg border border-[#E9B949]/40 bg-[#E9B949]/[0.08] p-3 text-sm text-[#F0DA92]'>
          <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-[#E9B949]' />
          This will create AWS resources in your account. You will be charged by AWS for these resources.
        </p>
        <div className='flex shrink-0 items-center justify-end gap-4'>
          <button
            type='button'
            className='inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary'
            onClick={onEditArchitecture}
          >
            <Pencil className='h-3.5 w-3.5' />
            Edit template
          </button>
          <Button
            variant='primary'
            onClick={onProvision}
            className='!border-[#F4D878]/70 !from-[#FFD700] !to-[#E9B949] !text-black hover:!from-[#FFE066] hover:!to-[#F4C430] active:!from-[#E9B949] active:!to-[#D4A83E]'
          >
            Provision
            <ArrowRight className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ReviewArchitecture
