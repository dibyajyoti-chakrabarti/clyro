import { ArrowRight, ShieldCheck } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'
import githubMark from '../../../../assets/logos/github-fill.svg'

function GithubMark({ size = 'lg' }) {
  const box = size === 'sm' ? 'h-9 w-9 rounded-md' : 'h-14 w-14 rounded-xl'
  const img = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  return (
    <div className={`grid place-items-center border border-border bg-background ${box}`}>
      <img src={githubMark} alt='GitHub' className={img} />
    </div>
  )
}

function GithubConnectCard({ existingInstallations, handleInstall, handleUseExisting }) {
  return (
    <WizardPanel>
      <WizardCard className='text-center'>
        <div className='flex justify-center'>
          <GithubMark />
        </div>
        <h3 className='mt-4 text-xl font-semibold tracking-tight'>Connect your GitHub account</h3>
        <p className='mx-auto mt-2 max-w-sm text-sm font-normal text-text-muted'>
          Clyro uses a GitHub App to securely access your repository. You choose exactly which repos to grant access to.
        </p>
        <Button variant='primary' className='mt-5' onClick={handleInstall}>
          Install Clyro GitHub App
        </Button>

        {existingInstallations.length > 0 && (
          <div className='mt-6 text-left'>
            <div className='flex items-center gap-3'>
              <div className='h-px flex-1 bg-border' />
              <span className='text-xs font-normal text-text-muted'>or use an existing account</span>
              <div className='h-px flex-1 bg-border' />
            </div>
            <div className='mt-3 space-y-1.5'>
              {existingInstallations.map((inst) => (
                <button
                  key={inst.id}
                  type='button'
                  className='flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary transition-colors hover:border-accent/60 hover:bg-surface'
                  onClick={() => handleUseExisting(inst)}
                >
                  <GithubMark size='sm' />
                  <span className='truncate'>{inst.account_login}</span>
                  <ArrowRight className='ml-auto h-4 w-4 text-text-muted' />
                </button>
              ))}
            </div>
          </div>
        )}

        <p className='mt-6 flex items-center justify-center gap-1.5 text-xs font-normal text-text-muted'>
          <ShieldCheck className='h-3.5 w-3.5 text-success' />
          Only repositories you explicitly grant access to will be visible
        </p>
      </WizardCard>
    </WizardPanel>
  )
}

export default GithubConnectCard
