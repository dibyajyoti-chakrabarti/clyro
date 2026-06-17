import ProgressBar from './ProgressBar'
import WizardNavbar from '../../../../components/wizard/WizardNavbar'
import { Box, Cloud, Folder, NotebookText, Rocket } from 'lucide-react'

export default function StepShell({
  currentStep,
  stepConfig,
  completedSteps,
  statusMap,
  totalSteps,
  currentStepData,
  projectName,
  fullWidth,
  children,
  footer,
}) {
  const stepIcons = {
    1: Folder,
    2: NotebookText,
    3: Box,
    4: Cloud,
    5: Rocket,
  }

  const mobileProgress =
    totalSteps > 1 ? `${Math.max(0, ((currentStep - 1) / (totalSteps - 1)) * 100)}%` : currentStep > 0 ? '100%' : '0%'

  return (
    <div className='flex w-full bg-surface/20'>
      <div className='flex min-w-0 flex-1 flex-col'>
        <WizardNavbar projectName={projectName} />

        <style>{`
          @keyframes wizardMobilePulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.08); opacity: .9; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>

        <div className='flex w-full'>
          <div className='hidden w-[290px] shrink-0 lg:block'>
            <ProgressBar currentStep={currentStep} stepConfig={stepConfig} completedSteps={completedSteps} statusMap={statusMap} />
          </div>

          <div className='flex min-w-0 flex-1 flex-col'>
            <div className='mx-4 mt-3 mb-5 rounded-[24px] border border-white/[0.08] bg-[rgba(10,15,25,0.55)] px-6 py-[14px] backdrop-blur-[20px] sm:mx-6 lg:hidden'>
              <div className='relative flex items-start justify-between gap-2 overflow-x-auto pb-1'>
                <span className='pointer-events-none absolute left-6 right-6 top-4 h-[2px] bg-[rgba(255,255,255,0.12)]' />
                <span
                  className='pointer-events-none absolute left-6 top-4 h-[2px] bg-[#E8B84B] transition-[width] duration-[300ms] ease-in-out'
                  style={{ width: mobileProgress }}
                />
                {stepConfig.map((step) => {
                  const Icon = stepIcons[step.number]
                  const isCompleted = completedSteps.has(step.number)
                  const isActive = currentStep === step.number

                  return (
                    <div key={step.number} className='relative z-10 min-w-[48px] flex-1 basis-0 text-center'>
                      <div
                        className={`mx-auto grid h-9 w-9 place-items-center rounded-full border transition-all duration-[250ms] ${
                          isActive
                            ? 'border-[#E8B84B] bg-[#E8B84B] text-[#111111] animate-[wizardMobilePulse_1.8s_ease-in-out_infinite]'
                            : isCompleted
                              ? 'border-[#E8B84B] bg-[#E8B84B] text-[#111111]'
                            : 'border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.03)] text-white/80'
                        }`}
                      >
                        <Icon className='h-4 w-4' />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className='flex flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8'>
              <div className='rounded-[24px] border border-white/[0.06] bg-[rgba(12,16,26,0.55)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-[16px] sm:p-8 lg:p-10'>
                <div className={`flex min-h-0 flex-1 flex-col ${fullWidth ? 'pt-4 sm:pt-6' : 'pt-6 sm:pt-8'}`}>
                  <header>
                    <h2 className='text-2xl font-semibold tracking-tight sm:text-3xl'>{currentStepData.title}</h2>
                    <p className='mt-2 text-sm text-text-muted'>{currentStepData.subtitle}</p>
                  </header>

                  <div className='flex min-h-0 flex-1 flex-col'>{children}</div>
                </div>
              </div>
            </div>

            {footer}
          </div>
        </div>
      </div>
    </div>
  )
}
