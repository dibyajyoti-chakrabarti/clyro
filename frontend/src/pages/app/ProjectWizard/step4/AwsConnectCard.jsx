import { ArrowRight, Check, Cloud } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

function AwsConnectCard({
  cfnConsoleUrl,
  urlLoading,
  stackOpened,
  arnInput,
  setArnInput,
  verifying,
  verifyError,
  roleConnected,
  onOpenStack,
  onVerify,
  onContinue,
}) {
  return (
    <WizardPanel>
      <WizardCard width='lg' className='text-center'>
        <div className='mx-auto grid h-12 w-12 place-items-center rounded-full border border-border bg-background'>
          <Cloud className='h-5 w-5 text-accent' />
        </div>
        <h3 className='mt-4 text-xl font-semibold tracking-tight'>Connect your AWS account</h3>
        <p className='mx-auto mt-2 max-w-md text-sm text-text-muted'>
          Clyro never stores your credentials. It uses a temporary IAM role that you can revoke at any time.
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
          <Button variant='primary' onClick={onOpenStack} disabled={urlLoading || !cfnConsoleUrl || roleConnected}>
            {urlLoading ? (
              <>
                <span className='h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin' />
                Preparing…
              </>
            ) : (
              <>
                Open AWS CloudFormation console
                <ArrowRight className='h-4 w-4' />
              </>
            )}
          </Button>
        </div>

        {stackOpened && !roleConnected ? (
          <div className='mx-auto mt-6 w-full max-w-md text-left'>
            <ol className='mb-3 space-y-1 text-sm text-text-muted list-none'>
              <li className='flex items-start gap-2'>
                <span className='shrink-0 font-semibold text-accent'>1.</span>
                Wait for the stack status to show <strong className='text-text-primary'>CREATE_COMPLETE</strong> (≈30s)
              </li>
              <li className='flex items-start gap-2'>
                <span className='shrink-0 font-semibold text-accent'>2.</span>
                Click the <strong className='text-text-primary'>Outputs</strong> tab in the CloudFormation console
              </li>
              <li className='flex items-start gap-2'>
                <span className='shrink-0 font-semibold text-accent'>3.</span>
                Copy the value next to <strong className='text-text-primary'>RoleArn</strong> — it starts with <code className='text-xs bg-white/5 px-1 py-0.5 rounded'>arn:aws:iam::</code>
              </li>
            </ol>
            <div className='flex gap-2'>
              <input
                type='text'
                placeholder='arn:aws:iam::123456789012:role/clyro-provisioning-…'
                value={arnInput}
                onChange={(e) => setArnInput(e.target.value)}
                className='w-full rounded-lg border border-white/[0.09] bg-background px-3.5 py-2.5 text-sm text-text-primary transition-[border-color,box-shadow] duration-150 hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20'
              />
              <Button
                variant='secondary'
                disabled={!arnInput.trim() || verifying}
                onClick={onVerify}
              >
                {verifying ? (
                  <span className='h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin' />
                ) : 'Verify'}
              </Button>
            </div>
            {verifyError ? (
              <p className='mt-2 text-xs text-red-400'>{verifyError}</p>
            ) : null}
          </div>
        ) : null}

        {roleConnected ? (
          <p className='mt-4 flex items-center justify-center gap-1.5 text-sm text-success'>
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
