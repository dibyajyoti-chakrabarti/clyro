import { GitBranch, ShieldCheck } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import DropDown from '../components/DropDown'
import PremiumStepHeading from './PremiumStepHeading'

function RepositorySelector({
  loadingRepos,
  selectedRepo,
  loadingBranches,
  selectedBranch,
  availableRepos,
  availableBranches,
  handleRepoChange,
  setSelectedBranch,
  handleScan,
  canScan,
}) {
  return (
    <div className='flex h-full w-full min-h-0 items-center justify-center box-border'>
      <style>{`
        @keyframes repoFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes repoButtonRise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className='w-full max-w-[700px] box-border text-center'>
        <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-[#E8B84B]'>
          STEP 1 OF 7
        </p>

        <PremiumStepHeading prefix='Connect your' highlight='repository' className='text-[clamp(44px,5.3vw,64px)]' />

        <p className='mx-auto mt-5 max-w-[650px] text-[22px] leading-[1.7] text-white/75'>
          Crylo scans your code to detect your stack, dependencies, and environment variables.
        </p>

        <div className='mx-auto mt-10 w-full max-w-[640px] rounded-[24px] border border-[rgba(212,175,55,0.35)] bg-[rgba(10,10,10,0.82)] p-10 text-left shadow-[0_18px_60px_rgba(0,0,0,0.40)]'>
          <div className='space-y-8'>
            <div className='space-y-3'>
              <label className='block text-[12px] font-medium uppercase tracking-[0.14em] text-white/60'>
                Repository
              </label>
              <div style={{ animation: 'repoFadeIn 250ms ease-out' }}>
                <DropDown
                  value={selectedRepo}
                  disabled={loadingRepos}
                  placeholder={loadingRepos ? 'Loading repositories…' : 'Select a repository…'}
                  options={availableRepos.map((repo) => ({ value: repo.full_name, label: repo.full_name }))}
                  onChange={(value) => handleRepoChange(value)}
                />
              </div>
            </div>

            <div className='space-y-3'>
              <label className='block text-[12px] font-medium uppercase tracking-[0.14em] text-white/60'>
                Branch
              </label>
              <div style={{ animation: 'repoFadeIn 250ms ease-out 120ms both' }}>
                <DropDown
                  value={selectedBranch}
                  disabled={selectedRepo === '' || loadingBranches}
                  placeholder={
                    selectedRepo === ''
                      ? 'Select a repository first'
                      : loadingBranches
                        ? 'Loading branches…'
                        : 'Select a branch…'
                  }
                  options={availableBranches.map((branch) => ({ value: branch, label: branch }))}
                  onChange={(value) => setSelectedBranch(value)}
                />
              </div>
            </div>

            <div className='pt-2' style={{ animation: 'repoButtonRise 250ms ease-out 220ms both' }}>
              <Button
                variant='primary'
                className='h-[64px] w-full rounded-[16px] border border-[#F2D57B]/60 bg-[linear-gradient(180deg,#FFD54A,#F6B700)] text-[22px] font-bold text-black shadow-[0_0_28px_rgba(232,184,75,0.22)] hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(232,184,75,0.30)]'
                onClick={handleScan}
                disabled={!canScan}
              >
                <GitBranch className='h-5 w-5' />
                Connect Repository
              </Button>
            </div>
          </div>
        </div>

        <div className='mt-10 flex items-center justify-center gap-4 text-[12px] font-medium uppercase tracking-[0.16em] text-white/70'>
          <div className='flex items-center gap-2'>
            <ShieldCheck className='h-4 w-4 text-[#E8B84B]' />
            <span>Secure</span>
          </div>
          <span className='text-white/30'>•</span>
          <div className='flex items-center gap-2'>
            <ShieldCheck className='h-4 w-4 text-[#E8B84B]' />
            <span>Read Only</span>
          </div>
          <span className='text-white/30'>•</span>
          <div className='flex items-center gap-2'>
            <ShieldCheck className='h-4 w-4 text-[#E8B84B]' />
            <span>No Code Changes</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RepositorySelector
