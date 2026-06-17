import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'
import Button from '../../components/ui/Button'
import StepProgress from '../../components/wizard/StepProgress'
import { api } from '../../api'
import CreateProject from './CreateProject'
import StepOne from './ProjectWizard/step1/StepOne'
import StepTwo from './ProjectWizard/step2/StepTwo'
import StepThree from './ProjectWizard/step3/StepThree'
import StepFour from './ProjectWizard/step4/StepFour'
import StepFive from './ProjectWizard/step5/StepFive'
import { stepConfig } from './ProjectWizard/constants/stepConfig'
import { STATUS_STEP, getCompletedSteps } from './ProjectWizard/constants/wizardStatuses'

export default function ProjectWizard() {
  const { id } = useParams()
  const navigate = useNavigate()

  const isNew = id === 'new'
  const [projectId, setProjectId] = useState(isNew ? null : id)
  const [loading, setLoading] = useState(!isNew)

  const [step, setStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState(() => new Set())
  const [projectData, setProjectData] = useState({
    repo: null,
    intent: {},
    scanResult: null,
    canvas: null,
    provision: null,
  })
  const [step1CanContinue, setStep1CanContinue] = useState(false)
  const [step2CanContinue, setStep2CanContinue] = useState(false)
  const [step3Finalized, setStep3Finalized] = useState(false)
  const [step3ShowBanner, setStep3ShowBanner] = useState(false)
  const [step3InputPrefill, setStep3InputPrefill] = useState('')
  const [step4CanContinue, setStep4CanContinue] = useState(false)

  useEffect(() => {
    if (isNew || !id) return

    api.getWizardState(id)
      .then(({ project, scan, intent }) => {
        const intentAnswers = intent ? {
          description: intent.description,
          scale: intent.scale,
          criticality: intent.criticality,
          environment: intent.environment,
          database_choice: intent.database_choice,
          worker_compute_choice: intent.worker_compute_choice,
          domain_has: intent.domain_has,
          domain_name: intent.domain_name,
        } : {}

        setProjectData({
          repo: project.repo_full_name
            ? { repo: project.repo_full_name, branch: project.repo_branch }
            : null,
          scanResult: scan || null,
          intent: intentAnswers,
          canvas: null,
          provision: null,
        })
        setStep(STATUS_STEP[project.status] ?? 1)
        setCompletedSteps(getCompletedSteps(project.status))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, isNew])

  if (loading) {
    return (
      <div className='flex min-h-[calc(100vh-121px)] items-center justify-center'>
        <div className='h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent' />
      </div>
    )
  }

  if (isNew && !projectId) {
    return <CreateProject />
  }

  const canAdvance = (currentStep) => {
    if (currentStep === 1) {
      return step1CanContinue
    }

    if (currentStep === 2) {
      return step2CanContinue
    }

    if (currentStep === 3) {
      return step3Finalized
    }

    if (currentStep === 4) {
      return step4CanContinue
    }

    return true
  }

  const currentStepData = stepConfig[step - 1]

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1))
  }

  const handleContinue = async () => {
    if (step === 3 && !step3Finalized) {
      try {
        if (projectId) await api.finalizeCanvas(projectId)
      } catch {
        // surface non-blocking; finalize can be retried
      }
      setStep3Finalized(true)
      setStep3ShowBanner(true)
      return
    }

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
    ? (step3Finalized ? 'Continue to step 4' : 'Finalize')
    : step === 4
      ? 'Provision'
      : step === 5
        ? 'Go to dashboard'
        : 'Continue'

  const fullWidth = step === 3 || step === 5
  const totalSteps = stepConfig.length

  return (
    <div className='flex min-h-[calc(100vh-121px)] overflow-hidden rounded-2xl border border-white/[0.07] bg-surface/20'>
      {/* Left rail â€” vertical step guide (desktop) */}
      <aside className='hidden w-[296px] shrink-0 flex-col justify-between border-r border-white/[0.06] bg-surface/40 px-7 py-8 lg:flex'>
        <div>
          <p className='mb-7 text-[11px] font-semibold uppercase tracking-widest text-text-muted'>
            Step {step} of {totalSteps}
          </p>
          <StepProgress steps={stepConfig} current={step} completed={completedSteps} />
        </div>
        <p className='flex items-center gap-1.5 text-xs text-text-muted'>
          <ShieldCheck className='h-3.5 w-3.5 text-success' />
          Nothing is provisioned until you confirm.
        </p>
      </aside>

      {/* Main column */}
      <div className='flex min-w-0 flex-1 flex-col'>
        {/* Mobile progress (rail is hidden below lg) */}
        <div className='border-b border-white/[0.06] px-5 py-4 lg:hidden'>
          <p className='text-xs font-medium text-text-muted'>
            Step {step} of {totalSteps} Â· <span className='text-text-primary'>{currentStepData.title}</span>
          </p>
          <div className='mt-2 h-1 overflow-hidden rounded-full bg-background'>
            <div
              className='h-full rounded-full bg-accent transition-all duration-500'
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className={`flex min-h-0 flex-1 flex-col ${fullWidth ? 'p-4 sm:p-6' : 'overflow-y-auto px-6 py-8 sm:px-10 sm:py-10'}`}>
          <header className={fullWidth ? 'shrink-0' : ''}>
            <h2 className='text-2xl font-semibold tracking-tight sm:text-3xl'>{currentStepData.title}</h2>
            <p className='mt-2 max-w-2xl text-sm text-text-muted'>{currentStepData.subtitle}</p>
          </header>

          {step === 1 ? (
            <StepOne
              projectId={projectId}
              projectData={projectData}
              setProjectData={setProjectData}
              setStep1CanContinue={setStep1CanContinue}
            />
          ) : null}

          {step === 2 ? (
            <StepTwo
              projectId={projectId}
              projectData={projectData}
              setProjectData={setProjectData}
              setStep2CanContinue={setStep2CanContinue}
            />
          ) : null}

          {step === 3 ? (
            <StepThree
              projectId={projectId}
              step3InputPrefill={step3InputPrefill}
              setStep3InputPrefill={setStep3InputPrefill}
              step3ShowBanner={step3ShowBanner}
              onDismissStep3Banner={() => setStep3ShowBanner(false)}
            />
          ) : null}

          {step === 4 ? (
            <StepFour
              setStep4CanContinue={setStep4CanContinue}
              onAdvanceToStepFive={() => {
                setCompletedSteps((prev) => {
                  const next = new Set(prev)
                  next.add(4)
                  return next
                })
                setStep(5)
              }}
            />
          ) : null}

          {step === 5 ? <StepFive /> : null}
        </div>

        {/* Footer nav â€” in-flow, no blur */}
        <div className='flex shrink-0 items-center justify-between border-t border-white/[0.06] bg-surface/40 px-6 py-4 sm:px-10'>
          <div>
            {step > 1 ? (
              <Button variant='ghost' onClick={handleBack}>
                <ArrowLeft className='h-4 w-4' />
                Back
              </Button>
            ) : null}
          </div>
          {step !== 4 ? (
            <Button
              variant='primary'
              onClick={handleContinue}
              disabled={!canAdvance(step) && !(step === 3 && !step3Finalized)}
            >
              {continueLabel}
              <ArrowRight className='h-4 w-4' />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
