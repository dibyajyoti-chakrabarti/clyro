import { ShieldCheck, ChevronRight } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import githubMark from '../../../../assets/logos/github-fill.svg'
import PremiumStepHeading from './PremiumStepHeading'

function GithubMark({ size = 'lg' }) {
  const outer = size === 'sm' ? 'h-10 w-10' : 'h-[96px] w-[96px]'
  const inner = size === 'sm' ? 'h-[40px] w-[40px]' : 'h-[72px] w-[72px]'
  const img = size === 'sm' ? 'h-4 w-4' : 'h-[80px] w-[80px]'
  return (
    <div className={`grid place-items-center rounded-full ${outer}`}>
      <div className={`grid place-items-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] shadow-[0_0_22px_rgba(255,255,255,0.04)] ${inner}`}>
        <img src={githubMark} alt='GitHub' className={img} />
      </div>
    </div>
  )
}

function GithubConnectCard({ existingInstallations, handleInstall, handleUseExisting }) {
  return (
    <div className='w-full text-center box-border'>
      <PremiumStepHeading prefix='Connect your' highlight='GitHub account' className='mx-auto max-w-[900px] text-[clamp(42px,5vw,72px)] font-extrabold text-[#F5F5F5]' />
      <p className='mx-auto mt-[20px] max-w-[720px] text-[clamp(18px,1.6vw,22px)] leading-[1.8] text-white/78'>
        Clyro uses a GitHub App to securely access your repository. You choose exactly which repositories to grant access to.
      </p>

      <div className='mx-auto mt-[32px] flex h-[88px] w-[88px] items-center justify-center rounded-full border border-[rgba(232,184,75,0.18)] bg-[rgba(255,255,255,0.06)] shadow-[0_0_28px_rgba(232,184,75,0.12)]'>
        <img src={githubMark} alt='GitHub' className='h-[52px] w-[52px]' />
      </div>

      <Button
        variant='primary'
        className='mx-auto mt-[32px] h-[68px] w-full max-w-[560px] rounded-[16px] border border-[#F2D57B]/60 bg-[linear-gradient(180deg,#FFD44D,#E5B329)] text-[22px] font-bold shadow-[0_0_28px_rgba(232,184,75,0.22)]'
        onClick={handleInstall}
      >
        Install Clyro GitHub App
      </Button>

      {existingInstallations.length > 0 && (
        <div className='mx-auto mt-[32px] w-full max-w-[560px]'>
          <div className='flex items-center gap-4'>
            <div className='h-px flex-1 bg-white/15' />
            <span className='text-[11px] font-medium uppercase tracking-[0.14em] text-white/60'>
              OR USE AN EXISTING ACCOUNT
            </span>
            <div className='h-px flex-1 bg-white/15' />
          </div>

          <div className='mt-[28px] space-y-3'>
            {existingInstallations.map((inst) => (
              <button
                key={inst.id}
                type='button'
                className='flex h-[72px] w-full items-center rounded-[16px] border border-[rgba(232,184,75,0.22)] bg-[#0F1114] px-4 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]'
                onClick={() => handleUseExisting(inst)}
              >
                <GithubMark size='sm' />
                <span className='ml-3 min-w-0 flex-1 truncate text-[15px] font-medium text-white/90'>
                  {inst.account_login}
                </span>
                <ChevronRight className='h-4 w-4 text-[#E8B84B]' />
              </button>
            ))}
          </div>
        </div>
      )}

      <p className='mt-[28px] flex items-center justify-center gap-1.5 text-[12px] text-white/65'>
        <ShieldCheck className='h-3.5 w-3.5 text-[#E8B84B]' />
        Only repositories you explicitly grant access to will be visible.
      </p>
    </div>
  )
}

export default GithubConnectCard
