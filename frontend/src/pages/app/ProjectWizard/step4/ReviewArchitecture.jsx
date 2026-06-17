import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

function ReviewArchitecture({ showTemplate, cfTemplate, onToggleTemplate, onEditArchitecture, onProvision }) {
  return (
    <WizardPanel>
      <WizardCard width='lg'>
        <h3 className='text-lg font-semibold'>What Clyro will create</h3>
        {/* TODO: derive review summary from canvas_version + intent_record via API */}

        <div className='mt-6'>
          <button type='button' className='text-sm font-medium text-accent hover:underline' onClick={onToggleTemplate}>
            {showTemplate ? 'Hide CloudFormation template' : 'View CloudFormation template'}
          </button>
          {showTemplate ? (
            <pre className='mt-3 max-h-48 overflow-y-auto rounded-md border border-border bg-background p-3 text-xs text-text-muted'>
              {cfTemplate}
            </pre>
          ) : null}
        </div>

        <p className='mt-6 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300'>
          <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
          This will create AWS resources in your account. You will be charged by AWS for these resources.
        </p>
        <div className='mt-4 flex items-center gap-4'>
          <button
            type='button'
            className='inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary'
            onClick={onEditArchitecture}
          >
            <ArrowLeft className='h-4 w-4' />
            Edit architecture
          </button>
          <Button variant='primary' onClick={onProvision}>
            Provision
            <ArrowRight className='h-4 w-4' />
          </Button>
        </div>
      </WizardCard>
    </WizardPanel>
  )
}

export default ReviewArchitecture
