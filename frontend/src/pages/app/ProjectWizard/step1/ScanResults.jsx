import { Check } from 'lucide-react'
import { useMemo } from 'react'
import githubMark from '../../../../assets/logos/github-fill.svg'

function GithubMark({ className = '' }) {
  return (
    <div className={`grid place-items-center rounded-[18px] border border-[rgba(255,196,0,0.16)] bg-[rgba(255,255,255,0.03)] ${className}`.trim()}>
      <img src={githubMark} alt='GitHub' className='h-10 w-10' />
    </div>
  )
}

function StatusRow({ label, index }) {
  return (
    <div
      className='flex items-center gap-4'
      style={{ animation: `statusRowIn 320ms ease-out ${140 + index * 70}ms both` }}
    >
      <span className='grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[rgba(34,197,94,0.34)] bg-[rgba(34,197,94,0.12)] text-[#7CFFB1] shadow-[0_0_12px_rgba(34,197,94,0.16)]'>
        <Check className='h-4 w-4' strokeWidth={3} />
      </span>
      <p className='text-[18px] font-medium leading-none text-white'>{label}</p>
    </div>
  )
}

function InfoCard({ title, description, index }) {
  return (
    <div
      className='flex h-[132px] w-full flex-col justify-between rounded-[20px] border border-[rgba(255,196,0,0.18)] bg-[rgba(12,12,12,0.85)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.25)]'
      style={{ animation: `infoCardIn 320ms ease-out ${180 + index * 80}ms both` }}
    >
      <div className='grid h-10 w-10 place-items-center rounded-full border border-[rgba(255,196,0,0.18)] bg-[rgba(255,196,0,0.08)] text-[#E8B84B] shadow-[0_0_16px_rgba(255,196,0,0.08)]'>
        <Check className='h-5 w-5' strokeWidth={3} />
      </div>
      <div>
        <p className='text-[16px] font-semibold text-white'>{title}</p>
        <p className='mt-1 text-[14px] leading-[1.45] text-white/68'>{description}</p>
      </div>
    </div>
  )
}

export default function ScanResults({
  selectedRepo,
  selectedBranch,
  isMonorepo,
  detectedServices,
  detectedInfra,
  generated,
  userSecrets,
  optional,
}) {
  const stackSummary = useMemo(() => {
    const inferred = [...detectedServices, ...detectedInfra].slice(0, 3)
    return inferred.length > 0 ? inferred.join(' • ') : 'React • Django • PostgreSQL'
  }, [detectedInfra, detectedServices])

  return (
    <div className='flex h-full min-h-0 w-full items-center justify-center'>
      <style>{`
        @keyframes successHeadingIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes successIconIn {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes repoCardIn {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes statusRowIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes infoCardIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className='flex w-full max-w-[760px] flex-col items-center text-center'>
        <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-[#E8B84B] opacity-90'>
          Step 1 complete
        </p>

        <h2
          className='mt-5 text-[clamp(44px,5.2vw,64px)] font-bold leading-[1.02] tracking-[-0.05em] text-white'
          style={{ animation: 'successHeadingIn 360ms ease-out both' }}
        >
          Repository connected{' '}
          <span className='bg-[linear-gradient(90deg,#FFF1B8_0%,#FFD84D_40%,#E8B84B_70%,#B8870B_100%)] bg-clip-text text-transparent'>
            Successfully
          </span>
        </h2>

        <p className='mx-auto mt-5 max-w-[700px] text-[22px] leading-[1.65] text-white/76'>
          Your repository has been verified and scanned.
          <br />
          An architecture draft has been generated and everything is ready for Step 2.
        </p>

        <div
          className='mt-12 grid h-[96px] w-[96px] place-items-center rounded-full border-2 border-[rgba(255,196,0,0.25)] bg-[rgba(255,196,0,0.08)] text-[#E8B84B] shadow-[0_0_0_1px_rgba(255,196,0,0.08),0_0_22px_rgba(255,196,0,0.14)]'
          style={{ animation: 'successIconIn 320ms ease-out 80ms both' }}
          aria-hidden='true'
        >
          <Check className='h-12 w-12 drop-shadow-[0_0_8px_rgba(255,196,0,0.22)]' strokeWidth={3} />
        </div>

        <div
          className='mt-12 w-full max-w-[640px] rounded-[20px] border border-[rgba(255,196,0,0.18)] bg-[rgba(12,12,12,0.85)] p-7 text-left shadow-[0_18px_44px_rgba(0,0,0,0.28)]'
          style={{ animation: 'repoCardIn 360ms ease-out 120ms both' }}
        >
          <div className='flex items-center gap-4'>
            <GithubMark className='h-14 w-14 shrink-0' />
            <div className='min-w-0 flex-1'>
              <p className='truncate text-[20px] font-semibold text-white'>
                {selectedRepo || 'bk9571/test-app'}
              </p>
              <p className='mt-1 text-[14px] text-white/66'>
                Branch: {selectedBranch || 'main'}
                {isMonorepo != null ? ` • ${isMonorepo ? 'monorepo' : 'single-service'}` : ''}
              </p>
            </div>
            <div className='hidden rounded-full border border-[rgba(255,196,0,0.18)] bg-[rgba(255,196,0,0.08)] px-3 py-1 text-[12px] font-medium text-[#E8B84B] sm:block'>
              Stack detected
            </div>
          </div>

          <div className='mt-5 rounded-[16px] border border-white/[0.06] bg-black/25 px-4 py-3'>
            <p className='text-[12px] font-semibold uppercase tracking-[0.16em] text-white/48'>Stack</p>
            <p className='mt-2 text-[17px] font-medium text-white/92'>{stackSummary}</p>
          </div>
        </div>

        <div className='mt-10 w-full max-w-[640px] text-left'>
          <div className='space-y-5'>
            {[
              'Repository connected',
              'Permissions verified',
              'Configuration analyzed',
              'Architecture draft generated',
            ].map((label, index) => (
              <StatusRow key={label} label={label} index={index} />
            ))}
          </div>
        </div>

        <div className='mt-10 grid w-full max-w-[700px] grid-cols-1 gap-4 md:grid-cols-3'>
          {[
            { title: 'Secure', description: 'Repository access encrypted' },
            { title: 'Draft Ready', description: 'Architecture generated' },
            { title: 'Next Step', description: 'Configure infrastructure' },
          ].map((card, index) => (
            <InfoCard key={card.title} {...card} index={index} />
          ))}
        </div>

        <div className='mt-8 text-[13px] text-white/50'>
          {generated.length > 0 ? `${generated.length} generated env vars` : 'Environment variables reviewed'}
          {userSecrets.length > 0 ? ` • ${userSecrets.length} secret${userSecrets.length > 1 ? 's' : ''}` : ''}
          {optional.length > 0 ? ` • ${optional.length} optional` : ''}
        </div>
      </div>
    </div>
  )
}
