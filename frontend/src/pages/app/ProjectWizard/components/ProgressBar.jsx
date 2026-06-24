import { useState } from 'react'
import { Box, Cloud, Folder, NotebookText, Rocket, ShieldCheck } from 'lucide-react'

export default function ProgressBar({ currentStep, stepConfig, completedSteps, statusMap }) {
  const totalSteps = stepConfig.length
  void statusMap
  const [collapsed, setCollapsed] = useState(false)

  const stepIcons = {
    1: Folder,
    2: NotebookText,
    3: Box,
    4: Cloud,
    5: Rocket,
  }

  return (
    <aside
      className={`hidden h-full shrink-0 flex-col rounded-[28px] border-2 border-[rgba(232,184,75,0.28)] bg-[linear-gradient(180deg,#090909_0%,#050505_100%)] py-[28px] text-white lg:flex ${
        collapsed ? 'w-[96px] px-[16px]' : 'w-[312px] px-[28px] xl:w-[320px]'
      }`}
    >
      <style>{`
        @keyframes wizardPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: .92; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div>
        {!collapsed ? (
          <p className='mb-8 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#E8B84B]'>
            Step {currentStep} of {totalSteps}
          </p>
        ) : null}

        <ol className={`relative ${collapsed ? 'space-y-[18px]' : 'space-y-[24px]'}`}>
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
                className={`relative ${collapsed ? 'flex flex-col items-center gap-2' : 'flex gap-5'}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <div className='relative w-[48px] shrink-0 sm:w-[44px] lg:w-[48px]'>
                  {!isLast ? (
                    <span
                      className={`pointer-events-none absolute left-[24px] top-[48px] h-[24px] w-[2px] -translate-x-1/2 bg-[rgba(255,255,255,0.12)] transition-colors duration-[300ms] ${
                        collapsed ? 'hidden' : ''
                      }`}
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

                {!collapsed ? (
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
                ) : null}
              </li>
            )
          })}
        </ol>
        <div className='mt-[24px]'>
          <button
            type='button'
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
            className={`w-full transition-[transform,opacity,background-color,border-color,box-shadow] duration-200 ease-out ${
              collapsed
                ? 'mx-auto flex h-[48px] w-[48px] items-center justify-center rounded-full border border-[rgba(255,196,0,0.22)] bg-[#0F0F0F] text-[#E8B84B] hover:scale-[1.05] hover:bg-[#171717] hover:shadow-[0_0_18px_rgba(255,196,0,0.22)]'
                : 'flex h-[52px] items-center justify-between rounded-[16px] border border-[rgba(255,196,0,0.18)] bg-[rgba(255,196,0,0.05)] px-[18px] text-[#F5F5F5] hover:-translate-x-0.5 hover:border-[rgba(255,196,0,0.28)] hover:bg-[rgba(255,196,0,0.08)] hover:shadow-[0_0_16px_rgba(255,196,0,0.12)]'
            }`}
          >
            {collapsed ? (
              <>
                <span className='sr-only'>Expand</span>
                <span className='text-[22px] leading-none text-[#E8B84B]'>&gt;</span>
              </>
            ) : (
              <>
                <span className='text-[16px] font-semibold text-[#F5F5F5]'>Collapse</span>
                <span className='text-[22px] leading-none text-[#E8B84B]'>&lt;</span>
              </>
            )}
          </button>
        </div>

        <div className={`transition-all duration-200 ease-out ${collapsed ? 'pointer-events-none mt-[20px] opacity-0' : 'mt-[24px] opacity-100'}`}>
          <p className='flex items-center gap-1.5 text-xs text-white/70'>
            <ShieldCheck className='h-3.5 w-3.5 text-[#E8B84B]' />
            Nothing is provisioned until you confirm.
          </p>
        </div>
      </div>
    </aside>
  )
}
