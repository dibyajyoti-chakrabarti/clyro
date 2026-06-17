import ProgressBar from './ProgressBar'

export default function StepShell({
  currentStep,
  stepConfig,
  completedSteps,
  statusMap,
  totalSteps,
  currentStepData,
  fullWidth,
  children,
  footer,
}) {
  return (
    <div className='flex h-full w-full overflow-hidden bg-surface/20'>
      <div className='w-[290px] shrink-0'>
        <ProgressBar currentStep={currentStep} stepConfig={stepConfig} completedSteps={completedSteps} statusMap={statusMap} />
      </div>

      <div className='flex min-w-0 flex-1 flex-col'>
        <div className='border-b border-white/[0.06] px-6 py-4 lg:hidden'>
          <p className='text-xs font-medium text-text-muted'>
            Step {currentStep} of {totalSteps} <span className='px-1'>{'\u00b7'}</span>{' '}
            <span className='text-text-primary'>{currentStepData.title}</span>
          </p>
          <div className='mt-2 h-1 overflow-hidden rounded-full bg-background'>
            <div
              className='h-full rounded-full bg-accent transition-all duration-500'
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className='flex h-full min-h-0 flex-1 flex-col overflow-auto px-6 py-6 sm:px-8 sm:py-8'>
          <div className='min-h-full rounded-[24px] border border-white/[0.06] bg-[rgba(12,16,26,0.55)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-[16px] sm:p-8 lg:p-10'>
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
  )
}
