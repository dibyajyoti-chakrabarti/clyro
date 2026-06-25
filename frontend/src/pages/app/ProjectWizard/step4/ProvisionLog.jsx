import { AlertTriangle, ArrowLeft, ArrowRight, Check, XCircle } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

function ProvisionLog({ provisioningLog, deployStatus, deployError, onRetry, onBack }) {
  const deployFailed = deployStatus === 'failed' || deployStatus === 'rolled_back'

  return (
    <WizardPanel>
      <WizardCard width='lg'>
        <div className='flex items-center gap-2'>
          {deployFailed ? (
            <XCircle className='h-5 w-5 text-red-400' />
          ) : (
            <span className='h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
          )}
          <h3 className='text-lg font-semibold'>
            {deployFailed ? 'Provisioning failed' : 'Provisioning infrastructure'}
          </h3>
        </div>
        {!deployFailed ? (
          <p className='mt-1 text-sm text-text-muted'>This typically takes 8–12 minutes — you can keep this tab open.</p>
        ) : null}

        <div className='mt-4 space-y-3'>
          {provisioningLog.length === 0 ? (
            <p className='text-sm text-text-muted'>Submitting your template to AWS…</p>
          ) : provisioningLog.map((entry) => {
            const isDone = entry.status === 'done'
            const isActive = entry.status === 'in_progress'
            const isFailed = entry.status === 'failed'
            const textClass = isFailed ? 'text-red-300' : isDone ? 'text-text-primary' : isActive ? 'text-accent' : 'text-text-muted'

            return (
              <div key={entry.sequence} className='flex items-start gap-3'>
                {isFailed ? (
                  <span className='mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-red-500/40 bg-red-500/15 text-red-300'>
                    <XCircle className='h-3.5 w-3.5' />
                  </span>
                ) : isDone ? (
                  <span className='mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300'>
                    <Check className='h-3 w-3' strokeWidth={3} />
                  </span>
                ) : isActive ? (
                  <span className='mt-0.5 h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin' />
                ) : (
                  <span className='mt-0.5 h-5 w-5 rounded-full border border-border bg-background' />
                )}
                <p className={`text-sm ${textClass}`}>{entry.plain_message}</p>
              </div>
            )
          })}
        </div>

        {deployFailed ? (
          <div className='mt-5'>
            {deployError ? (
              <p className='flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300'>
                <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
                {deployError}
              </p>
            ) : null}
            <div className='mt-4 flex items-center gap-4'>
              <button
                type='button'
                className='inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary'
                onClick={onBack}
              >
                <ArrowLeft className='h-4 w-4' />
                Back
              </button>
              <Button variant='primary' onClick={onRetry}>
                Retry
                <ArrowRight className='h-4 w-4' />
              </Button>
            </div>
          </div>
        ) : null}
      </WizardCard>
    </WizardPanel>
  )
}

export default ProvisionLog
