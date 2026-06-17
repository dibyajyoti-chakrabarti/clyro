import { Box, Cloud, Folder, NotebookText, Rocket, ShieldCheck } from 'lucide-react'

export default function ProgressBar({ currentStep, stepConfig, completedSteps, statusMap }) {
  const totalSteps = stepConfig.length
  void statusMap

  const stepIcons = {
    1: Folder,
    2: NotebookText,
    3: Box,
    4: Cloud,
    5: Rocket,
  }

  const lineProgress =
    totalSteps > 1 ? `${Math.max(0, ((currentStep - 1) / (totalSteps - 1)) * 100)}%` : currentStep > 0 ? '100%' : '0%'

  return (
    <aside className='hidden w-[290px] shrink-0 flex-col bg-transparent px-[36px] py-[36px] lg:flex'>
      <style>{`
        @keyframes wizardPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: .9; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes wizardRing {
          0% { transform: scale(1); opacity: .45; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>

      <div>
        <p className='mb-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E8B84B]'>
          Step {currentStep} of {totalSteps}
        </p>

        <ol className='relative space-y-[44px]'>
          <span className='pointer-events-none absolute left-[24px] top-[24px] bottom-[24px] w-[2px] -translate-x-1/2 bg-[rgba(255,255,255,0.12)]' />
          <span
            className='pointer-events-none absolute left-[24px] top-[24px] w-[2px] -translate-x-1/2 bg-[#E8B84B] transition-[height] duration-[400ms] ease-in-out'
            style={{ height: lineProgress }}
          />

          {stepConfig.map((step, index) => {
            const Icon = stepIcons[step.number]
            const isCompleted = completedSteps.has(step.number)
            const isActive = currentStep === step.number

            const circleClassName = isCompleted
              ? 'border-[#E8B84B] bg-[#E8B84B] text-[#111111]'
              : isActive
                ? 'border-[#E8B84B] bg-[#E8B84B] text-[#111111]'
                : 'border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.03)] text-white/85'

            const iconClassName = isCompleted || isActive ? 'h-5 w-5' : 'h-5 w-5 opacity-85'

            return (
              <li key={step.number} className='relative flex gap-[18px]'>
                <div className='relative w-[48px] shrink-0'>
                  <div
                    className={`group relative z-10 grid h-[48px] w-[48px] place-items-center rounded-full border transition-all duration-[250ms] hover:-translate-y-0.5 ${
                      isActive ? 'animate-[wizardPulse_1.6s_ease-in-out_infinite]' : ''
                    } ${circleClassName}`}
                  >
                    {isActive ? (
                      <span
                        className='pointer-events-none absolute inset-0 rounded-full border border-[#E8B84B]/45'
                        style={{ animation: 'wizardRing 2s ease-in-out infinite' }}
                      />
                    ) : null}

                    <Icon
                      className={iconClassName}
                      strokeWidth={2}
                      fill={isCompleted || isActive ? 'currentColor' : 'currentColor'}
                      style={{
                        color: isCompleted ? '#111111' : isActive ? '#111111' : '#FFFFFF',
                      }}
                    />
                  </div>
                </div>

                <div className='min-w-0 pt-[2px]'>
                  <p className='text-[18px] font-medium leading-[1.2] text-white'>{step.title}</p>
                  {isActive ? (
                    <p className='mt-[6px] text-[13px] font-medium uppercase tracking-[0.08em] text-[#E8B84B]'>
                      In progress
                    </p>
                  ) : isCompleted ? (
                    <p className='mt-[6px] text-[13px] font-medium uppercase tracking-[0.08em] text-[#E8B84B]'>
                      Done
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <p className='mt-auto flex items-center gap-1.5 pt-8 text-xs text-text-muted'>
        <ShieldCheck className='h-3.5 w-3.5 text-[#E8B84B]' />
        Nothing is provisioned until you confirm.
      </p>
    </aside>
  )
}
