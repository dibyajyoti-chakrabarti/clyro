import { Check } from 'lucide-react'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

function ProvisionLog({ provisioningLog }) {
  return (
    <WizardPanel>
      <WizardCard width='lg'>
        <h3 className='text-lg font-semibold'>Provisioning infrastructure</h3>
        <div className='mt-4 space-y-3'>
          {provisioningLog.map((entry) => {
            const isDone = entry.status === 'complete'
            const isActive = entry.status === 'in_progress' || entry.status === 'running'
            const textClass = isDone ? 'text-text-primary' : isActive ? 'text-accent' : 'text-text-muted'

            return (
              <div key={entry.sequence} className='flex items-start gap-3'>
                {isDone ? (
                  <span className='mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300'>
                    <Check className='h-3 w-3' strokeWidth={3} />
                  </span>
                ) : isActive ? (
                  <span className='mt-0.5 h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin' />
                ) : (
                  <span className='mt-0.5 h-5 w-5 rounded-full border border-border bg-background' />
                )}
                <div>
                  <p className={`text-sm ${textClass}`}>{entry.plain_message}</p>
                </div>
              </div>
            )
          })}
        </div>
      </WizardCard>
    </WizardPanel>
  )
}

export default ProvisionLog
