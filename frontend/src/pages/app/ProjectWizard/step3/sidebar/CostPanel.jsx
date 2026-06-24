import { Database, Globe, Layers, Package, Server, Workflow, Zap } from 'lucide-react'

const iconByLabel = (label) => {
  const lower = label.toLowerCase()
  if (lower.includes('backend') || lower.includes('ecs fargate')) return Server
  if (lower.includes('frontend') || lower.includes('cloudfront') || lower.includes('s3')) return Globe
  if (lower.includes('postgres') || lower.includes('database') || lower.includes('rds')) return Database
  if (lower.includes('redis') || lower.includes('cache') || lower.includes('elasticache')) return Zap
  if (lower.includes('worker')) return Workflow
  if (lower.includes('sqs') || lower.includes('queue')) return Layers
  return Package
}

export default function CostPanel({ canvasCost, totalCost }) {
  return (
    <div className='flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[rgba(255,193,7,0.10)] bg-[rgba(10,10,10,0.42)] shadow-[0_24px_80px_rgba(0,0,0,0.28),0_0_60px_rgba(255,193,7,0.05)] backdrop-blur-[20px]'>
      <div className='flex items-start justify-end px-4 pt-4'>
        <button
          type='button'
          aria-label='Close cost drawer'
          className='grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-text-muted transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-[rgba(255,193,7,0.18)] hover:bg-[rgba(255,255,255,0.05)] hover:text-text-primary'
        >
          <span className='text-sm leading-none'>x</span>
        </button>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border'>
        <div className='rounded-[18px] border border-[rgba(255,193,7,0.10)] bg-[rgba(255,255,255,0.03)] p-5 backdrop-blur-[12px] transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-[rgba(255,193,7,0.16)]'>
          <p className='text-[13px] font-medium text-text-muted'>Estimated Monthly Cost</p>
          <div className='mt-3 flex items-end gap-2'>
            <p className='text-[48px] font-semibold leading-none tracking-tight text-text-primary'>${totalCost}</p>
            <p className='pb-1 text-[16px] font-medium text-text-muted'>/month</p>
          </div>
          <div className='mt-4 space-y-1'>
            <p className='text-sm font-medium text-text-primary'>Production Environment</p>
            <p className='text-sm text-text-muted'>us-east-1</p>
          </div>
        </div>

        <div className='mt-4 space-y-2'>
          {canvasCost.map((item) => {
            const Icon = iconByLabel(item.label)
            return (
              <div
                key={item.label}
                className='flex items-center justify-between rounded-[12px] border border-white/[0.04] bg-white/[0.02] px-3 py-3 backdrop-blur-[12px] transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:border-[rgba(255,193,7,0.10)] hover:bg-white/[0.03]'
              >
                <div className='flex min-w-0 items-center gap-3'>
                  <div className='grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-white/[0.05] bg-white/[0.03] text-text-muted'>
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
            <li>Region: us-east-1</li>
            <li>Runtime: 730 hrs/month</li>
            <li>Data transfer excluded</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
