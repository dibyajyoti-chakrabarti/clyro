import { Check } from 'lucide-react'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

function ScanProgress({ scanMessages, scanStep }) {
  const total = Math.max(scanMessages.length - 1, 1)
  const progressPercent = Math.round((scanStep / total) * 100)

  return (
    <WizardPanel>
      <WizardCard>
        <h3 className='text-lg font-semibold'>Connecting repository</h3>
        <div className='mt-4 space-y-3'>
          {scanMessages.map((item, index) => {
            const isDone = index < scanStep
            const isActive = index === scanStep
            const textClass = isDone
              ? 'text-text-primary'
              : isActive
                ? 'text-accent'
                : 'text-text-muted'

            return (
              <div key={item} className='flex items-center gap-3'>
                {isDone ? (
                  <span className='grid h-5 w-5 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300'>
                    <Check className='h-3 w-3' strokeWidth={3} />
                  </span>
                ) : isActive ? (
                  <span className='h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent' />
                ) : (
                  <span className='h-5 w-5 rounded-full border border-border bg-background' />
                )}
                <p className={`text-sm font-normal ${textClass}`}>{item}</p>
              </div>
            )
          })}
        </div>

        <div className='mt-5 h-1.5 overflow-hidden rounded-full bg-background'>
          <div
            className='h-full rounded-full bg-gradient-to-r from-accent/80 to-accent transition-all duration-500 ease-out'
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className='mt-2 text-right text-xs text-text-muted'>{progressPercent}%</p>
      </WizardCard>
    </WizardPanel>
  )
}

export default ScanProgress
