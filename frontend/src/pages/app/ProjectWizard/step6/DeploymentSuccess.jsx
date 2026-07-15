import { ArrowRight, CheckCircle2, Copy, Pause, Play, Trash2 } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

function DeploymentSuccess({
  stackOutputs = [], copiedKey, onCopy, onGoToDashboard,
  deployStatus, infraActionLoading, infraActionError, onPause, onResume, onTeardown,
}) {
  const isPaused = deployStatus === 'paused'
  const isDeleting = deployStatus === 'deleting'
  const isDeleted = deployStatus === 'deleted'
  return (
    <WizardPanel>
      <WizardCard width='lg' className='border-green-500/25'>
        <div className='flex items-center justify-center'>
          <CheckCircle2 className='h-12 w-12 text-green-400' />
        </div>
        <h3 className='mt-4 text-center text-xl font-semibold tracking-tight'>Your infrastructure is live</h3>

        <div className='mt-6 space-y-2'>
          {stackOutputs.length === 0 ? (
            <p className='text-center text-sm text-text-muted'>No stack outputs were returned.</p>
          ) : stackOutputs.map((o) => (
            <div key={o.key} className='flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2'>
              <div className='min-w-0'>
                <p className='text-xs text-text-muted'>{o.description || o.key}</p>
                <p className='truncate text-sm font-medium text-text-primary'>{o.value}</p>
              </div>
              <button
                type='button'
                className='flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:border-accent/60 hover:text-text-primary'
                onClick={() => onCopy(o.key, o.value)}
              >
                <Copy className='h-3 w-3' />
                {copiedKey === o.key ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>

        <div className='mt-6'>
          <h4 className='text-sm font-semibold'>Next steps</h4>
          <div className='mt-2 space-y-2 text-sm text-text-muted'>
            {[
              'Point your domain DNS to the CloudFront URL above',
              'Set up your CI/CD pipeline to push to ECR on merge to main',
              'Your architecture is saved and visible in the canvas',
            ].map((tip) => (
              <div key={tip} className='flex items-start gap-2'>
                <ArrowRight className='mt-0.5 h-4 w-4 shrink-0 text-text-muted' />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {!isDeleted && (
          <div className='mt-6 rounded-lg border border-border bg-background/50 p-4'>
            <h4 className='text-sm font-semibold'>Manage infrastructure</h4>
            <p className='mt-1 text-xs text-text-muted'>
              {isPaused
                ? 'Infra is paused — ECS tasks are scaled to 0 and the database is stopped. Nothing is billed for compute while paused.'
                : isDeleting
                  ? 'Deleting all provisioned resources…'
                  : 'Pause to stop billing without losing anything, or permanently delete the stack.'}
            </p>
            {infraActionError && (
              <p className='mt-2 text-xs text-red-400'>{infraActionError}</p>
            )}
            <div className='mt-3 flex flex-wrap gap-2'>
              {isPaused ? (
                <Button variant='secondary' disabled={infraActionLoading} onClick={onResume}>
                  <Play className='h-4 w-4' />
                  Resume
                </Button>
              ) : (
                <Button variant='secondary' disabled={infraActionLoading || isDeleting} onClick={onPause}>
                  <Pause className='h-4 w-4' />
                  Pause
                </Button>
              )}
              <Button
                variant='danger'
                disabled={infraActionLoading || isDeleting}
                onClick={onTeardown}
              >
                <Trash2 className='h-4 w-4' />
                {isDeleting ? 'Deleting…' : 'Delete infrastructure'}
              </Button>
            </div>
          </div>
        )}

        <Button variant='primary' className='mt-6' onClick={onGoToDashboard}>
          Go to dashboard
          <ArrowRight className='h-4 w-4' />
        </Button>
      </WizardCard>
    </WizardPanel>
  )
}

export default DeploymentSuccess
