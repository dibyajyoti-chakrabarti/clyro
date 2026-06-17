import { Check } from 'lucide-react'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'
import githubMark from '../../../../assets/logos/github-fill.svg'

function GithubMark({ size = 'sm' }) {
  const box = size === 'sm' ? 'h-9 w-9 rounded-md' : 'h-14 w-14 rounded-xl'
  const img = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  return (
    <div className={`grid place-items-center border border-border bg-background ${box}`}>
      <img src={githubMark} alt='GitHub' className={img} />
    </div>
  )
}

function ScanResults({
  selectedRepo,
  selectedBranch,
  isMonorepo,
  detectedServices,
  detectedInfra,
  envVars,
  generated,
  userSecrets,
  optional,
}) {
  return (
    <WizardPanel>
      <WizardCard width='lg' className='space-y-5 p-5'>
        <div className='flex items-stretch overflow-hidden rounded-lg border border-border bg-background'>
          <div className='w-1 bg-accent' />
          <div className='flex flex-1 items-center gap-3 p-3'>
            <GithubMark size='sm' />
            <div className='min-w-0'>
              <p className='truncate text-sm font-medium text-text-primary'>{selectedRepo}</p>
              <p className='text-xs font-normal text-text-muted'>Branch: {selectedBranch}{isMonorepo != null ? ` Â· ${isMonorepo ? 'monorepo' : 'single-service'}` : ''}</p>
            </div>
          </div>
        </div>

        {detectedServices.length > 0 && (
          <div>
            <p className='text-xs font-medium text-text-muted uppercase tracking-wide mb-2'>Detected services</p>
            <div className='space-y-1.5'>
              {detectedServices.map((s) => (
                <div key={s} className='flex items-center gap-2 text-sm text-text-primary'>
                  <span className='grid h-4 w-4 shrink-0 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300'><Check className='h-2.5 w-2.5' strokeWidth={3} /></span>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {detectedInfra.length > 0 && (
          <div>
            <p className='text-xs font-medium text-text-muted uppercase tracking-wide mb-2'>Detected infrastructure</p>
            <div className='space-y-1.5'>
              {detectedInfra.map((s) => (
                <div key={s} className='flex items-center gap-2 text-sm text-text-primary'>
                  <span className='grid h-4 w-4 shrink-0 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300'><Check className='h-2.5 w-2.5' strokeWidth={3} /></span>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {envVars.length > 0 && (
          <div>
            <p className='text-xs font-medium text-text-muted uppercase tracking-wide mb-2'>Environment variables ({envVars.length} detected)</p>
            <div className='flex flex-wrap gap-2'>
              {generated.length > 0 && (
                <span className='rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs text-green-300'>
                  {generated.length} auto-generated
                </span>
              )}
              {userSecrets.length > 0 && (
                <span className='rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300'>
                  {userSecrets.length} user secret{userSecrets.length > 1 ? 's' : ''}
                </span>
              )}
              {optional.length > 0 && (
                <span className='rounded-full border border-border bg-background px-2.5 py-1 text-xs text-text-muted'>
                  {optional.length} optional
                </span>
              )}
            </div>
          </div>
        )}

        <div className='flex items-center gap-2 pt-1 text-xs font-normal text-text-muted border-t border-border'>
          <span className='grid h-4 w-4 shrink-0 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300'><Check className='h-2.5 w-2.5' strokeWidth={3} /></span>
          Architecture draft generated â€” ready for Step 2
        </div>
      </WizardCard>
    </WizardPanel>
  )
}

export default ScanResults
