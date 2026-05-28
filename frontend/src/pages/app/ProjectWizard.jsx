import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button'

const stepConfig = [
  {
    number: 1,
    title: 'Connect your repository',
    subtitle: 'Crylo scans your code to detect your stack, dependencies, and environment variables.',
  },
  {
    number: 2,
    title: 'Tell us about your app',
    subtitle: 'Answer a few questions to shape the infrastructure to your actual needs.',
  },
  {
    number: 3,
    title: 'Review your architecture',
    subtitle: 'Inspect and refine the generated architecture before provisioning.',
  },
  {
    number: 4,
    title: 'Connect AWS & provision',
    subtitle: 'Link your AWS account, confirm secrets, and deploy your infrastructure.',
  },
  {
    number: 5,
    title: 'Your infrastructure is live',
    subtitle: 'Monitor health, performance, and cost in real time.',
  },
]

export default function ProjectWizard() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState(() => new Set())
  const [projectData, setProjectData] = useState({
    repo: null,
    intent: {},
    canvas: null,
    provision: null,
  })

  const canAdvance = (currentStep) => {
    void currentStep
    return true
  }

  const currentStepData = stepConfig[step - 1]

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1))
  }

  const handleContinue = () => {
    if (!canAdvance(step)) {
      return
    }

    setProjectData((prev) => ({ ...prev }))

    if (step === 5) {
      navigate('/app/dashboard')
      return
    }

    setCompletedSteps((prev) => {
      const next = new Set(prev)
      next.add(step)
      return next
    })

    setStep((prev) => Math.min(5, prev + 1))
  }

  const continueLabel = step === 3
    ? 'Finalize'
    : step === 4
      ? 'Provision'
      : step === 5
        ? 'Go to dashboard'
        : 'Continue'

  return (
    <div className='relative min-h-[calc(100vh-121px)]'>
      <h1 className='text-2xl font-semibold tracking-tight'>Project {id || 'ABC'} Wizard</h1>

      <div className='fixed inset-x-0 top-[73px] z-20 border-b border-border bg-surface/95 backdrop-blur'>
        <div className='mx-auto w-full max-w-6xl px-6 py-4'>
          <div className='flex items-start justify-center gap-6 md:gap-10'>
            {stepConfig.map((item) => {
              const isCompleted = completedSteps.has(item.number)
              const isActive = step === item.number
              const circleClass = isCompleted
                ? 'border-accent bg-accent text-background'
                : isActive
                  ? 'border-accent bg-surface ring-2 ring-accent/35'
                  : 'border-border bg-background text-text-muted'
              const labelClass = isActive ? 'font-medium text-text-primary' : 'font-normal text-text-muted'

              return (
                <div key={item.number} className='flex flex-col items-center gap-2'>
                  <div className={`grid h-9 w-9 place-items-center rounded-full border text-sm ${circleClass}`}>
                    {item.number}
                  </div>
                  <p className={`text-center text-xs ${labelClass}`}>{item.title}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className='pb-24 pt-36'>
        <section className='mx-auto flex min-h-[calc(100vh-270px)] w-full max-w-[640px] flex-col'>
          <div className='w-fit rounded-full border border-border px-3 py-1 text-xs font-normal text-text-muted'>
            Step {step} of 5
          </div>
          <h2 className='mt-4 text-4xl font-semibold tracking-tight'>{currentStepData.title}</h2>
          <p className='mt-3 text-sm font-normal text-text-muted'>{currentStepData.subtitle}</p>

          <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
            <div className='grid h-full min-h-[260px] place-items-center rounded-lg border border-border/70 bg-surface'>
              <p className='text-sm font-normal text-text-muted'>Step {step} content — coming soon</p>
            </div>
          </div>
        </section>
      </div>

      <div className='fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur'>
        <div className='mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4'>
          <div>
            {step > 1 ? (
              <Button variant='ghost' onClick={handleBack}>
                Back
              </Button>
            ) : null}
          </div>
          <Button variant='primary' onClick={handleContinue} disabled={!canAdvance(step)}>
            {continueLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
