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

  return (
    <aside className='hidden h-full w-[312px] shrink-0 flex-col rounded-[28px] border-2 border-[rgba(232,184,75,0.28)] bg-[linear-gradient(180deg,#090909_0%,#050505_100%)] px-[28px] py-[28px] text-white lg:flex xl:w-[320px]'>
      <style>{`
        @keyframes wizardPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: .92; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div>
        <p className='mb-8 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#E8B84B]'>
          Step {currentStep} of {totalSteps}
        </p>

        <ol className='relative space-y-[24px]'>
          {stepConfig.map((step, index) => {
            const Icon = stepIcons[step.number]
            const isCompleted = completedSteps.has(step.number)
            const isActive = currentStep === step.number
            const isLast = index === stepConfig.length - 1

            const circleClassName = isCompleted || isActive
              ? 'border-[#E8B84B] bg-[#E8B84B] text-[#111111]'
              : 'border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.03)] text-white/80'

            return (
              <li
                key={step.number}
                className='relative flex gap-5'
                aria-current={isActive ? 'step' : undefined}
              >
                <div className='relative w-[48px] shrink-0 sm:w-[44px] lg:w-[48px]'>
                  {!isLast ? (
                    <span
                      className='pointer-events-none absolute left-[24px] top-[48px] h-[24px] w-[2px] -translate-x-1/2 bg-[rgba(255,255,255,0.12)] transition-colors duration-[300ms]'
                      style={{ backgroundColor: isCompleted ? '#E8B84B' : 'rgba(255,255,255,0.12)' }}
                    />
                  ) : null}
                  <div
                    className={`group relative z-10 grid h-[48px] w-[48px] place-items-center rounded-full border-[1.5px] transition-all duration-[250ms] hover:-translate-y-0.5 sm:h-[44px] sm:w-[44px] lg:h-[48px] lg:w-[48px] ${
                      isActive ? 'animate-[wizardPulse_1.8s_ease-in-out_infinite]' : ''
                    } ${circleClassName}`}
                  >
                    {isActive ? (
                      <span className='pointer-events-none absolute inset-0 rounded-full border border-[#E8B84B]/45' />
                    ) : null}

                    <Icon className='h-5 w-5 text-current' />
                  </div>
                </div>

                <div className='min-w-0 pt-[1px]'>
                  <p className='max-w-[196px] whitespace-normal break-words text-[16px] font-semibold leading-[1.35] text-white'>
                    {step.title}
                  </p>
                  {isActive ? (
                    <p className='mt-[6px] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#E8B84B]'>
                      In progress
                    </p>
                  ) : isCompleted ? (
                    <p className='mt-[6px] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#E8B84B]'>
                      Done
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <p className='mt-6 flex items-center gap-1.5 pt-6 text-xs text-white/70'>
        <ShieldCheck className='h-3.5 w-3.5 text-[#E8B84B]' />
        Nothing is provisioned until you confirm.
      </p>
    </aside>
  )
}
