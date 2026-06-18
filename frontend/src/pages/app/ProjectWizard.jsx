import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Box, Cloud, Folder, NotebookText, Rocket } from 'lucide-react'
import Button from '../../components/ui/Button'
import WizardNavbar from '../../components/wizard/WizardNavbar'
import { api } from '../../api'
import CreateProject from './CreateProject'
import StepProgress from './ProjectWizard/components/StepProgress'
import StepOne from './ProjectWizard/step1/StepOne'
import StepTwo from './ProjectWizard/step2/StepTwo'
import StepThree from './ProjectWizard/step3/StepThree'
import StepFour from './ProjectWizard/step4/StepFour'
import StepFive from './ProjectWizard/step5/StepFive'
import { stepConfig } from './ProjectWizard/constants/stepConfig'
import { STATUS_STEP } from './ProjectWizard/constants/wizardStatuses'

export default function ProjectWizard() {
  const { id } = useParams()
  const navigate = useNavigate()

  const isNew = id === 'new'
  const [projectId, setProjectId] = useState(isNew ? null : id)
  const [loading, setLoading] = useState(!isNew)

  const [step, setStep] = useState(1)
  const [projectName, setProjectName] = useState('')
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
        setProjectName(project.name || '')
        setStep(STATUS_STEP[project.status] ?? 1)
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

    setStep((prev) => Math.min(5, prev + 1))
  }

  const continueLabel = step === 3
    ? (step3Finalized ? 'Continue to step 4' : 'Finalize')
    : step === 4
      ? 'Provision'
      : step === 5
        ? 'Go to dashboard'
        : 'Continue'

  const totalSteps = stepConfig.length
  const completedSteps = new Set(stepConfig.filter(({ number }) => number < step).map(({ number }) => number))
  const mobileProgress =
    totalSteps > 1 ? `${Math.max(0, ((step - 1) / (totalSteps - 1)) * 100)}%` : step > 0 ? '100%' : '0%'

  const stepIcons = {
    1: Folder,
    2: NotebookText,
    3: Box,
    4: Cloud,
    5: Rocket,
  }

  const footer = (
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
  )

  return (
    <div className='min-h-screen w-full bg-[#040404] p-4 text-white'>
      <WizardNavbar projectName={projectName} />

      <main className='mt-4 flex min-h-[calc(100vh-104px)] w-full gap-5'>
        <div className='hidden lg:block'>
          <StepProgress currentStep={step} stepConfig={stepConfig} completedSteps={completedSteps} statusMap={STATUS_STEP} />
        </div>

        <div className='flex min-w-0 flex-1 flex-col'>
          <div className='mx-auto mb-4 w-full max-w-[1680px] lg:hidden'>
            <div className='rounded-[24px] border border-white/[0.08] bg-[rgba(10,15,25,0.55)] px-6 py-[14px] backdrop-blur-[20px]'>
              <div className='relative flex items-start justify-between gap-2 overflow-x-auto pb-1'>
                <span className='pointer-events-none absolute left-6 right-6 top-4 h-[2px] bg-[rgba(255,255,255,0.12)]' />
                <span
                  className='pointer-events-none absolute left-6 top-4 h-[2px] bg-[#E8B84B] transition-[width] duration-[300ms] ease-in-out'
                  style={{ width: mobileProgress }}
                />
                {stepConfig.map((item) => {
                  const isCompleted = completedSteps.has(item.number)
                  const isActive = step === item.number

                  return (
                    <div key={item.number} className='relative z-10 min-w-[48px] flex-1 basis-0 text-center'>
                      <div
                        className={`mx-auto grid h-9 w-9 place-items-center rounded-full border transition-all duration-[250ms] ${
                          isActive
                            ? 'border-[#E8B84B] bg-[#E8B84B] text-[#111111]'
                            : isCompleted
                              ? 'border-[#E8B84B] bg-[#E8B84B] text-[#111111]'
                              : 'border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.03)] text-white/80'
                        }`}
                      >
                        {(() => {
                          const Icon = stepIcons[item.number]
                          return <Icon className='h-4 w-4' />
                        })()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <section className='flex min-h-0 flex-1 flex-col rounded-[30px] border border-[rgba(232,184,75,0.20)] bg-[linear-gradient(180deg,#0F0F10,#090909)] p-12 shadow-[0_30px_80px_rgba(0,0,0,0.45)]'>
            <div className='flex flex-1 flex-col justify-between'>
              <div className='text-center'>
                <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-[#E8B84B]'>
                  STEP {step} OF {totalSteps}
                </p>
                <h1 className='mt-6 text-[clamp(42px,5.5vw,64px)] font-extrabold leading-[0.96] tracking-[-0.04em] text-white'>
                  {currentStepData.title}
                </h1>
                <p className='mx-auto mt-6 max-w-[700px] text-[clamp(18px,1.8vw,22px)] leading-[1.6] text-white/72'>
                  {currentStepData.subtitle}
                </p>
              </div>

              <div className='mt-10 flex min-h-0 flex-1 flex-col'>
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
                      setStep(5)
                    }}
                  />
                ) : null}

                {step === 5 ? <StepFive /> : null}
              </div>

              {footer}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
