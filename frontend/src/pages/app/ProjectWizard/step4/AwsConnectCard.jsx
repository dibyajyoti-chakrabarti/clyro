import { ArrowRight, Check, Cloud } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

function AwsConnectCard({ handleRoleConnect, isWaitingRole, roleConnected, onContinue }) {
  return (
    <WizardPanel>
      <WizardCard width='lg' className='text-center'>
        <div className='mx-auto grid h-12 w-12 place-items-center rounded-full border border-border bg-background'>
          <Cloud className='h-5 w-5 text-accent' />
        </div>
        <h3 className='mt-4 text-xl font-semibold tracking-tight'>Connect your AWS account</h3>
        <p className='mx-auto mt-2 max-w-md text-sm text-text-muted'>
          Crylo never stores your credentials. It uses a temporary IAM role that you can revoke at any time.
        </p>
        <div className='mx-auto mt-5 max-w-md space-y-2 text-left'>
          {[
            'No access keys or secret keys required',
            'Role can be deleted to immediately revoke access',
            'Same pattern used by Terraform Cloud and Pulumi',
          ].map((item) => (
            <div key={item} className='flex items-center gap-2 text-sm text-text-muted'>
              <Check className='h-4 w-4 shrink-0 text-success' />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className='mt-6'>
          <Button variant='primary' onClick={handleRoleConnect} disabled={isWaitingRole || roleConnected}>
            Open AWS CloudFormation console
            <ArrowRight className='h-4 w-4' />
          </Button>
        </div>
        {isWaitingRole ? (
          <div className='mt-3 flex items-center justify-center gap-2 text-xs text-text-muted'>
            <div className='h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
            <span>Waiting for role creation...</span>
          </div>
        ) : null}
        {roleConnected ? (
          <p className='mt-3 flex items-center justify-center gap-1.5 text-sm text-success'>
            <Check className='h-4 w-4' strokeWidth={3} />
            IAM role connected
          </p>
        ) : null}
        {roleConnected ? (
          <Button variant='secondary' className='mt-4' onClick={onContinue}>
            Continue
            <ArrowRight className='h-4 w-4' />
          </Button>
        ) : null}
      </WizardCard>
    </WizardPanel>
  )
}

export default AwsConnectCard
