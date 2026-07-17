import { Database, DollarSign, Globe, Layers, Package, Server, Workflow, X, Zap } from 'lucide-react'

const iconByLabel = (label) => {
  const lower = label.toLowerCase()
  if (lower.includes('backend') || lower.includes('ecs fargate')) return { Icon: Server, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' }
  if (lower.includes('frontend') || lower.includes('cloudfront') || lower.includes('s3')) return { Icon: Globe, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' }
  if (lower.includes('postgres') || lower.includes('database') || lower.includes('rds')) return { Icon: Database, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' }
  if (lower.includes('redis') || lower.includes('cache') || lower.includes('elasticache')) return { Icon: Zap, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' }
  if (lower.includes('worker')) return { Icon: Workflow, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' }
  if (lower.includes('sqs') || lower.includes('queue')) return { Icon: Layers, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' }
  return { Icon: Package, color: 'text-text-muted', bg: 'bg-white/[0.03] border-white/[0.05]' }
}

const ENVIRONMENT_LABELS = {
  production: 'Production',
  staging: 'Staging',
  development: 'Development',
}

const DEFAULT_ASSUMPTIONS = ['Region: us-east-1', 'Runtime: 730 hrs/month', 'Data transfer excluded']

export default function CostPanel({ canvasCost, totalCost, assumptions, environment, onClose }) {
  const environmentLabel = ENVIRONMENT_LABELS[environment] || 'Production'
  const displayedAssumptions = assumptions && assumptions.length > 0 ? assumptions : DEFAULT_ASSUMPTIONS
  return (
    <div className='flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[rgba(255,193,7,0.10)] bg-[rgba(10,10,10,0.42)] shadow-[0_24px_80px_rgba(0,0,0,0.28),0_0_60px_rgba(255,193,7,0.05)] backdrop-blur-[20px]'>
      <div className='shrink-0 px-4 pt-4 pb-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex items-center gap-2'>
            <span className='grid h-8 w-8 place-items-center rounded-full border border-[rgba(255,193,7,0.12)] bg-[rgba(255,193,7,0.06)] text-accent'>
              <DollarSign className='h-4 w-4' />
            </span>
            <div>
              <p className='text-[16px] font-semibold leading-5 tracking-tight text-text-primary'>Cost Overview</p>
              <p className='mt-0.5 text-[12px] text-text-muted'>AWS infrastructure estimate</p>
            </div>
          </div>
          {onClose ? (
            <button
              type='button'
              onClick={onClose}
              title='Close cost drawer'
              aria-label='Close cost drawer'
              className='grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.02] text-text-muted transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-[rgba(255,193,7,0.18)] hover:bg-[rgba(255,255,255,0.04)] hover:text-text-primary'
            >
              <X className='h-4 w-4' />
            </button>
          ) : null}
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border'>
        <div className='rounded-[18px] border border-[rgba(255,193,7,0.10)] bg-[rgba(255,255,255,0.03)] p-5 backdrop-blur-[12px] transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-[rgba(255,193,7,0.16)]'>
          <p className='text-[13px] font-medium text-text-muted'>Estimated Monthly Cost</p>
          <div className='mt-3 flex items-end gap-2'>
            <p className='text-[48px] font-semibold leading-none tracking-tight text-text-primary'>${totalCost}</p>
            <p className='pb-1 text-[16px] font-medium text-text-muted'>/month</p>
          </div>
          <div className='mt-4 flex items-center gap-2'>
            <span className='h-1.5 w-1.5 rounded-full bg-emerald-400' />
            <p className='text-xs text-text-muted'>Live estimate · {environmentLabel} · us-east-1</p>
          </div>
        </div>

        <div className='mt-4 space-y-2'>
          {canvasCost.map((item) => {
            const { Icon, color, bg } = iconByLabel(item.label)
            return (
              <div
                key={item.label}
                className='flex items-center justify-between rounded-[12px] border border-white/[0.04] bg-white/[0.02] px-3 py-3 backdrop-blur-[12px] transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:border-[rgba(255,193,7,0.10)] hover:bg-white/[0.03]'
              >
                <div className='flex min-w-0 items-center gap-3'>
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border ${bg} ${color}`}>
                    <Icon className='h-4 w-4' />
                  </div>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-medium text-text-primary'>{item.label}</p>
                    <p className='text-xs text-text-muted'>Infrastructure component</p>
                  </div>
                </div>
                <p className='shrink-0 text-sm font-semibold text-text-primary'>${item.monthly}/mo</p>
              </div>
            )
          })}
        </div>

        <div className='mt-4 rounded-[16px] border border-[rgba(255,193,7,0.08)] bg-white/[0.02] px-4 py-4 backdrop-blur-[12px]'>
          <p className='text-[13px] font-medium text-text-primary'>Pricing Assumptions</p>
          <ul className='mt-2 space-y-1.5 text-xs leading-5 text-text-muted'>
            {displayedAssumptions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <p className='mt-3 px-1 text-center text-[11px] text-text-muted/60'>Costs are estimates and may vary based on actual usage</p>
      </div>
    </div>
  )
}
