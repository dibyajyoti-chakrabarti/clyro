import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import Button from '../../../../components/ui/Button'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'
import { buildCfnBom } from '../../../../utils/cfnBom'

function ReviewArchitecture({ showTemplate, cfTemplate, onToggleTemplate, onEditArchitecture, onProvision }) {
  const bom = useMemo(() => buildCfnBom(cfTemplate), [cfTemplate])

  return (
    <WizardPanel>
      <WizardCard width='lg'>
        <h3 className='text-lg font-semibold'>What Clyro will create</h3>

        {bom ? (
          <>
            <p className='mt-1 text-sm text-text-muted'>
              {bom.total} AWS resource{bom.total === 1 ? '' : 's'} will be created in your account.
            </p>
            <div className='mt-4 overflow-hidden rounded-lg border border-border'>
              {bom.groups.map((group) => (
                <div key={group.service} className='border-b border-border px-4 py-3 last:border-b-0'>
                  <p className='text-xs font-medium uppercase tracking-wide text-text-muted'>{group.service}</p>
                  <ul className='mt-1.5 space-y-1'>
                    {group.items.map((item) => (
                      <li key={item.type} className='flex items-center justify-between gap-4 text-sm'>
                        <span title={item.names.join(', ')}>{item.label}</span>
                        {item.count > 1 ? <span className='shrink-0 text-text-muted'>×{item.count}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        ) : null}

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
            Edit template
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
