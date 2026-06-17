import { ArrowRight, CheckCircle2, Copy } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

function DeploymentSuccess({ copiedKey, onCopy, onGoToDashboard }) {
  return (
    <WizardPanel>
      <WizardCard width='lg' className='border-green-500/25'>
        <div className='flex items-center justify-center'>
          <CheckCircle2 className='h-12 w-12 text-green-400' />
        </div>
        <h3 className='mt-4 text-center text-xl font-semibold tracking-tight'>Your infrastructure is live</h3>

        {/* TODO: fetch from GET /api/deployments/{id}/outputs/ */}
        <div className='mt-6 space-y-2'>
          {[
            ['Frontend URL', '—'],
            ['Backend API', '—'],
            ['CloudFront URL', '—'],
          ].map(([label, value]) => (
            <div key={label} className='flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2'>
              <div>
                <p className='text-xs text-text-muted'>{label}</p>
                <p className='text-sm font-medium text-text-primary'>{value}</p>
              </div>
              <button
                type='button'
                className='flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:border-accent/60 hover:text-text-primary'
                onClick={() => onCopy(label, value)}
              >
                <Copy className='h-3 w-3' />
                {copiedKey === label ? 'Copied!' : 'Copy'}
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

        <Button variant='primary' className='mt-6' onClick={onGoToDashboard}>
          Go to dashboard
          <ArrowRight className='h-4 w-4' />
        </Button>
      </WizardCard>
    </WizardPanel>
  )
}

export default DeploymentSuccess
