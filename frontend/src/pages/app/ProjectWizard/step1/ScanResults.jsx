import { Check, ChevronRight, GitBranch, Layers3, Lock, PackageSearch, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import GitHubLogo from '../../../../components/common/GitHubLogo'

function StackPill({ children }) {
  return (
    <span className='rounded-full border border-[rgba(255,196,0,0.14)] bg-[rgba(255,255,255,0.03)] px-[18px] py-[10px] text-[12px] font-medium text-white/78 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset,0_0_18px_rgba(255,196,0,0.04)]'>
      {children}
    </span>
  )
}

function TimelineItem({ icon: Icon, title, description, index }) {
  return (
    <div className='pb-[18px]' style={{ animation: `timelineIn 340ms ease-out ${120 + index * 90}ms both` }}>
      <div className='flex items-start gap-4'>
        <div className='grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.10)] text-[#81F2A9] shadow-[0_0_16px_rgba(34,197,94,0.12)]'>
          <Icon className='h-5 w-5' strokeWidth={2.6} />
        </div>
        <div className='min-w-0 flex-1'>
          <p className='text-[18px] font-semibold tracking-[-0.02em] text-white'>{title}</p>
          <p className='mt-1.5 max-w-[420px] text-[14px] leading-[1.5] text-white/62'>{description}</p>
        </div>
      </div>
      <div className='mt-[18px] h-px bg-[linear-gradient(90deg,rgba(255,196,0,0.12),rgba(255,255,255,0.05),transparent)]' />
    </div>
  )
}

function SummaryCard({ title, description, icon: Icon, index }) {
  return (
    <div
      className='group flex h-[230px] flex-1 flex-col justify-between rounded-[22px] border border-[rgba(255,196,0,0.14)] bg-[rgba(12,12,12,0.65)] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.22),0_0_24px_rgba(255,196,0,0.04)] transition-transform duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_22px_46px_rgba(0,0,0,0.28),0_0_26px_rgba(255,196,0,0.08)]'
      style={{ animation: `cardIn 340ms ease-out ${160 + index * 80}ms both` }}
    >
      <div className='grid place-items-start gap-4'>
        <div className='grid h-16 w-16 place-items-center rounded-full border border-[rgba(255,196,0,0.16)] bg-[rgba(255,196,0,0.08)] text-[#E8B84B] shadow-[0_0_16px_rgba(255,196,0,0.08)]'>
          <Icon className='h-7 w-7' strokeWidth={2.4} />
        </div>
        <p className='text-[20px] font-semibold tracking-[-0.01em] text-white'>{title}</p>
        <p className='max-w-[240px] text-[15px] leading-[1.55] text-white/64'>{description}</p>
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
    const inferred = [...detectedServices, ...detectedInfra].slice(0, 4)
    return inferred.length > 0 ? inferred : ['Django', 'React', 'Celery', 'PostgreSQL']
  }, [detectedInfra, detectedServices])

  return (
    <div className='flex h-full min-h-0 w-full items-stretch'>
      <style>{`
        @keyframes titleIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes timelineIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className='grid h-full min-h-0 w-full grid-cols-1 gap-8 px-0 py-0 lg:grid-cols-[58%_42%] lg:gap-10 lg:items-start lg:p-[32px]'>
        <div className='flex min-h-0 flex-col items-center justify-start text-center lg:items-stretch lg:justify-start lg:text-left'>
          <div className='flex min-h-0 flex-1 flex-col items-center justify-center text-center gap-[18px]'>
            <p className='rounded-full border border-[rgba(255,196,0,0.16)] bg-[rgba(255,196,0,0.06)] px-[22px] py-[10px] text-[13px] font-bold uppercase tracking-[0.18em] text-[#E8B84B]'>
              Step 1 of 5
            </p>

            <h2
              className='max-w-[720px] text-[clamp(54px,5.8vw,80px)] font-extrabold leading-[0.9] tracking-[-0.075em] text-white'
              style={{ animation: 'titleIn 360ms ease-out both' }}
            >
              Repository Connected
              <br />
              <span className='bg-[linear-gradient(90deg,#FFF2C4_0%,#FFD35C_34%,#E8B84B_66%,#B8870B_100%)] bg-clip-text text-transparent'>
                Successfully.
              </span>
            </h2>

            <p className='max-w-[600px] text-[20px] leading-[1.6] text-white/82'>
              Your repository has been verified and scanned. An architecture draft has been generated and everything is ready for Step 2.
            </p>

            <div className='w-full max-w-[860px] rounded-[28px] border border-[rgba(255,196,0,0.15)] bg-[rgba(8,8,8,0.82)] p-8 text-left shadow-none'>
              <div className='flex items-start justify-between gap-5'>
                <div className='flex min-w-0 items-start gap-4'>
                  <div className='grid h-[72px] w-[72px] place-items-center rounded-[18px] border border-[rgba(255,196,0,0.16)] bg-[rgba(255,255,255,0.03)] shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]'>
                    <GitHubLogo className='h-8 w-8' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-[20px] font-semibold tracking-[-0.02em] text-white'>
                      {selectedRepo || 'bk9571/test-app'}
                    </p>
                    <div className='mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-white/62'>
                      <span className='inline-flex items-center gap-2'>
                        <GitBranch className='h-4 w-4 text-[#E8B84B]' strokeWidth={2.4} />
                        Branch • {selectedBranch || 'main'}
                      </span>
                      <span className='h-1 w-1 rounded-full bg-white/22' />
                      <span>{isMonorepo ? 'monorepo' : 'single-service'}</span>
                    </div>
                  </div>
                </div>

                <div className='inline-flex items-center gap-2 self-start rounded-full border border-[rgba(255,196,0,0.16)] bg-[rgba(255,196,0,0.08)] px-[22px] py-[12px] text-[12px] font-semibold tracking-[0.06em] text-[#E8B84B]'>
                  <Check className='h-4 w-4' strokeWidth={3} />
                  Stack Detected
                </div>
              </div>

              <div className='mt-6 border-t border-white/[0.06] pt-5'>
                <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-white/42'>Detected Stack</p>
                <div className='mt-4 flex flex-wrap gap-[10px]'>
                  {stackSummary.map((item) => (
                    <StackPill key={item}>{item}</StackPill>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className='flex min-h-0 flex-col gap-[18px] text-left'>
          <div className='space-y-0'>
            <TimelineItem icon={GitBranch} title='Repository connected' description='Repository linked successfully' index={0} />
            <TimelineItem icon={Lock} title='Permissions verified' description='Secure OAuth completed' index={1} />
            <TimelineItem icon={PackageSearch} title='Configuration analyzed' description='Project structure scanned' index={2} />
            <div style={{ animation: 'timelineIn 340ms ease-out 390ms both' }}>
              <div className='flex items-start gap-4 pb-[18px]'>
                <div className='grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.10)] text-[#81F2A9] shadow-[0_0_16px_rgba(34,197,94,0.12)]'>
                  <Layers3 className='h-5 w-5' strokeWidth={2.6} />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-[18px] font-semibold tracking-[-0.02em] text-white'>Architecture draft generated</p>
                  <p className='mt-1.5 max-w-[360px] text-[14px] leading-[1.5] text-white/62'>
                    Infrastructure blueprint ready
                  </p>
                </div>
              </div>
              <div className='h-px bg-[linear-gradient(90deg,rgba(255,196,0,0.12),rgba(255,255,255,0.05),transparent)]' />
            </div>
          </div>

          <div className='grid grid-cols-1 gap-[18px] xl:grid-cols-3'>
            <SummaryCard title='Secure Access' description='Encrypted GitHub connection' icon={ShieldCheck} index={0} />
            <SummaryCard title='Draft Ready' description='Architecture generated' icon={Layers3} index={1} />
            <SummaryCard title='Next Step' description='Configure infrastructure' icon={ChevronRight} index={2} />
          </div>
        </div>
      </div>
    </div>
  )
}
