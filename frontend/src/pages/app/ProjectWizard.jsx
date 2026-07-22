import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, ArrowRight, Box, Cloud, FileCode, Folder, NotebookText, Rocket } from 'lucide-react'
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
import StepSix from './ProjectWizard/step6/StepSix'
import StepSeven from './ProjectWizard/step7/StepSeven'
import { stepConfig } from './ProjectWizard/constants/stepConfig'
import { STATUS_STEP } from './ProjectWizard/constants/wizardStatuses'


export default function ProjectWizard() {
  const { id } = useParams()
  const navigate = useNavigate()

  const isNew = id === 'new'
  const projectId = isNew ? null : id
  const [loading, setLoading] = useState(!isNew)

  const [step, setStep] = useState(1)
  const [projectName, setProjectName] = useState('')
  const [projectData, setProjectData] = useState({
    repo: null,
    intent: {},
    scanResult: null,
    connection: null,
    canvas: null,
    provision: null,
  })
  const [step1CanContinue, setStep1CanContinue] = useState(false)
  const [step2CanContinue, setStep2CanContinue] = useState(false)
  const [step3CanContinue, setStep3CanContinue] = useState(false)
  const [step4Finalized, setStep4Finalized] = useState(false)
  const [step4ShowBanner, setStep4ShowBanner] = useState(false)
  const [step4InputPrefill, setStep4InputPrefill] = useState('')
  const [step4Metrics, setStep4Metrics] = useState({ serviceCount: 0, estimatedMonthlyCost: 0 })

  useEffect(() => {
    if (isNew || !id) {
      setLoading(false)
      return
    }
    setLoading(true)

    api.getWizardState(id)
      .then(({ project, scan, intent, connection }) => {
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
          // Step 2 (Connect your AWS account) resumes into role-connect vs.
          // already-verified based on this — without it a refresh mid-connect
          // would re-prompt the CloudFormation role stack. The user's self-reported
          // account type is also read from here (connection.account_type), not from
          // intent — Step 2 now owns that capture, right before verification.
          connection: connection || null,
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
      return step3CanContinue
    }

    if (currentStep === 4) {
      return step4Finalized
    }

    return true
  }

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1))
  }

  const handleContinue = async () => {
    if (step === 4 && !step4Finalized) {
      try {
        if (projectId) await api.finalizeCanvas(projectId)
      } catch {
        // surface non-blocking; finalize can be retried
      }
      setStep4Finalized(true)
      setStep4ShowBanner(true)
      return
    }

    if (!canAdvance(step)) {
      return
    }

    setProjectData((prev) => ({ ...prev }))

    if (step === 7) {
      navigate('/app/dashboard')
      return
    }

    setStep((prev) => Math.min(7, prev + 1))
  }

  const continueLabel = step === 4
    ? (step4Finalized ? 'Continue to step 5' : 'Finalize')
    : step === 7
      ? 'Go to dashboard'
      : 'Continue'

  const totalSteps = stepConfig.length
  const completedSteps = new Set(stepConfig.filter(({ number }) => number < step).map(({ number }) => number))
  const mobileProgress =
    totalSteps > 1 ? `${Math.max(0, ((step - 1) / (totalSteps - 1)) * 100)}%` : step > 0 ? '100%' : '0%'

  const stepIcons = {
    1: Folder,
    2: Cloud,
    3: NotebookText,
    4: Box,
    5: FileCode,
    6: Rocket,
    7: Activity,
  }

  return (
    <div className='box-border min-h-screen w-full max-w-full overflow-x-hidden bg-[#040404] p-[4px] text-white'>
	      <main className='flex min-h-[calc(100vh-8px)] w-full max-w-full items-stretch gap-[4px] overflow-x-hidden box-border'>
        <div className='hidden self-stretch lg:block'>
          <StepProgress currentStep={step} stepConfig={stepConfig} completedSteps={completedSteps} statusMap={STATUS_STEP} />
        </div>

	        <div className='flex min-h-0 min-w-0 flex-1 flex-col gap-[4px] box-border'>
          <div className='w-full lg:hidden'>
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

          <WizardNavbar projectName={projectName} />

          <section
            className={`box-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[rgba(255,196,0,0.35)] shadow-[0_30px_80px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,196,0,0.08),0_0_18px_rgba(255,196,0,0.06)] ${
              step === 4 || step === 5 ? 'p-0' : 'px-[64px] pb-[28px] pt-[28px]'
            } ${step === 6 ? 'relative' : ''}`}
            style={{
              backgroundImage:
                'radial-gradient(circle at 100% 0%, rgba(232,184,75,0.08), transparent 28%), radial-gradient(circle at 50% 0%, rgba(255,255,255,0.025), transparent 24%), linear-gradient(180deg,#0d0d0d,#070707)',
            }}
          >
            <div className={`box-border flex min-h-0 flex-1 flex-col ${step === 4 || step === 5 ? 'items-stretch' : 'items-center'}`}>
                {step === 1 ? (
                  <StepOne
                    projectId={projectId}
                    projectData={projectData}
                    setProjectData={setProjectData}
                    setStep1CanContinue={setStep1CanContinue}
                    onComplete={() => setStep((prev) => Math.min(7, prev + 1))}
                  />
                ) : null}

                {step === 2 ? (
                  <StepTwo
                    projectId={projectId}
                    projectData={projectData}
                    setProjectData={setProjectData}
                    setStep2CanContinue={setStep2CanContinue}
                    onBack={handleBack}
                    onContinue={handleContinue}
                  />
                ) : null}

                {step === 3 ? (
                  <StepThree
                    projectId={projectId}
                    projectData={projectData}
                    setProjectData={setProjectData}
                    setStep3CanContinue={setStep3CanContinue}
                    onComplete={() => setStep((prev) => Math.min(7, prev + 1))}
                  />
                ) : null}

                {step === 4 ? (
                  <StepFour
                    projectId={projectId}
                    projectData={projectData}
                    step4InputPrefill={step4InputPrefill}
                    setStep4InputPrefill={setStep4InputPrefill}
                    step4ShowBanner={step4ShowBanner}
                    onDismissStep4Banner={() => setStep4ShowBanner(false)}
                    onMetricsChange={setStep4Metrics}
                  />
                ) : null}

                {step === 5 ? (
                  <StepFive
                    projectId={projectId}
                    projectData={projectData}
                    setProjectData={setProjectData}
                    onBackToCanvas={() => setStep(4)}
                    onAdvanceToStepSix={() => setStep(6)}
                  />
                ) : null}

                {step === 6 ? (
                  <StepSix
                    projectId={projectId}
                    projectData={projectData}
                    setProjectData={setProjectData}
                    onBackToIac={() => setStep(5)}
                    onAdvanceToStepSeven={() => setStep(7)}
                  />
                ) : null}

                {step === 7 ? <StepSeven projectId={projectId} /> : null}
            </div>

            {/* Steps 1, 3, 5, 6 manage their own navigation (Step 1 advances itself once
                secrets are staged, via onComplete); step 4 uses Finalize inline. Step 2
                moves Back/Continue into its own success bar once the IAM role connects,
                so the shared footer steps aside at that point to avoid a duplicate row. */}
            {step !== 1 && step !== 3 && step !== 5 && step !== 6 && !(step === 2 && projectData?.connection?.connected) && (
              <div
                className={`mt-auto flex w-full flex-col items-stretch justify-between gap-3 pt-8 sm:flex-row sm:items-center ${
                  step === 4 ? 'px-8 pb-8' : ''
                }`}
              >
                {step > 1 ? (
                  <Button
                    variant='secondary'
                    onClick={handleBack}
                    className={`h-14 w-full justify-center gap-2 rounded-[18px] px-6 text-sm font-semibold sm:w-auto ${
                      step === 4 ? 'sm:w-[190px]' : 'sm:min-w-[180px]'
                    }`}
                  >
                    <ArrowLeft className='h-4 w-4' />
                    Back
                  </Button>
                ) : (
                  <div />
                )}
                {step === 4 ? (
                  <Button
                    variant='primary'
                    onClick={handleContinue}
                    disabled={!canAdvance(step) && !(step === 4 && !step4Finalized)}
                    className='h-14 w-full justify-center gap-2 rounded-[18px] px-6 text-sm font-semibold transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(255,196,0,0.18)] sm:w-[190px]'
                  >
                    {/* Use continueLabel: after the first click finalizes, this becomes
                        "Continue to step 5" instead of a stuck "Finalize" that gave no
                        signal the second click advances (the "click Finalize twice" bug). */}
                    {continueLabel}
                    <ArrowRight className='h-4 w-4' />
                  </Button>
                ) : (
                  <Button
                    variant='primary'
                    onClick={handleContinue}
                    disabled={!canAdvance(step) && !(step === 4 && !step4Finalized)}
                    className='h-14 w-full justify-center gap-2 rounded-[18px] px-6 text-sm font-semibold sm:w-auto sm:min-w-[180px]'
                  >
                    {continueLabel}
                    <ArrowRight className='h-4 w-4' />
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
