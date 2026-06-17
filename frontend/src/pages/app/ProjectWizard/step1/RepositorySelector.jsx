import { ArrowLeft } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import Select from '../../../../components/ui/Select'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

function RepositorySelector({
  loadingRepos,
  selectedRepo,
  loadingBranches,
  selectedBranch,
  availableRepos,
  availableBranches,
  handleRepoChange,
  setSelectedBranch,
  setPhase,
  handleScan,
  canScan,
}) {
  return (
    <WizardPanel>
      <WizardCard>
        <button
          type='button'
          className='mb-4 inline-flex items-center gap-1 text-xs font-normal text-text-muted transition-colors hover:text-text-primary'
          onClick={() => setPhase('connect')}
        >
          <ArrowLeft className='h-3.5 w-3.5' />
          Change account
        </button>

        <div className='space-y-4'>
          <Select
            label='Repository'
            value={selectedRepo}
            disabled={loadingRepos}
            placeholder={loadingRepos ? 'Loading repositoriesâ€¦' : 'Select a repositoryâ€¦'}
            options={availableRepos.map((repo) => ({ value: repo.full_name, label: repo.full_name }))}
            onChange={(event) => handleRepoChange(event.target.value)}
          />

          <Select
            label='Branch'
            value={selectedBranch}
            disabled={selectedRepo === '' || loadingBranches}
            placeholder={
              selectedRepo === ''
                ? 'Select a repository first'
                : loadingBranches
                  ? 'Loading branchesâ€¦'
                  : 'Select a branchâ€¦'
            }
            options={availableBranches.map((branch) => ({ value: branch, label: branch }))}
            onChange={(event) => setSelectedBranch(event.target.value)}
          />

          <Button variant='primary' className='w-full' onClick={handleScan} disabled={!canScan}>
            Connect repository
          </Button>
        </div>
      </WizardCard>
    </WizardPanel>
  )
}

export default RepositorySelector
