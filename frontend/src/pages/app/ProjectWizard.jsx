import { useEffect, useState } from 'react'
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

const scanMessages = [
  'Connecting to repository...',
  'Pass 1 - reading file tree...',
  'Pass 2 - reading high-signal files...',
  'Pass 3 - running detection rules...',
  'Generating draft architecture...',
]

const scanDurations = [600, 1200, 1800, 1400, 800]

const detectionItems = [
  { label: 'Django Backend', target: 'ECS Fargate', source: 'from requirements.txt', mono: 'DJ' },
  { label: 'React Frontend', target: 'S3 + CloudFront', source: 'from package.json', mono: 'RE' },
  { label: 'PostgreSQL', target: 'RDS PostgreSQL', source: 'from settings.py', mono: 'PG' },
  { label: 'Redis Cache', target: 'ElastiCache', source: 'from settings.py', mono: 'RD' },
  { label: 'Celery Workers', target: 'ECS Fargate', source: 'from celery.py', mono: 'CE' },
  { label: 'SQS Queue', target: '(from Celery detection)', source: 'from Celery detection', mono: 'SQ' },
]

const envRows = [
  { key: 'SECRET_KEY', cls: 'user secret', source: 'settings/base.py' },
  { key: 'STRIPE_SECRET_KEY', cls: 'user secret', source: 'settings/production.py' },
  { key: 'DATABASE_URL', cls: 'auto-generated', source: 'from RDS instance' },
  { key: 'REDIS_URL', cls: 'auto-generated', source: 'from ElastiCache' },
  { key: 'DEBUG', cls: 'optional', source: 'production default: False' },
]

function GithubMark() {
  return (
    <div className='grid h-14 w-14 place-items-center rounded-xl border border-border bg-background text-lg font-semibold'>
      GH
    </div>
  )
}

function statusBadgeClass(cls) {
  if (cls === 'user secret') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  }

  if (cls === 'auto-generated') {
    return 'border-green-500/30 bg-green-500/10 text-green-300'
  }

  return 'border-border bg-background text-text-muted'
}

function StepOnePanel({ projectData, setProjectData, setStep1CanContinue }) {
  const [phase, setPhase] = useState('connect')
  const [selectedRepo, setSelectedRepo] = useState(projectData.repo?.repo || '')
  const [selectedBranch, setSelectedBranch] = useState(projectData.repo?.branch || '')
  const [scanStep, setScanStep] = useState(0)
  const [blockReason, setBlockReason] = useState('')

  useEffect(() => {
    setStep1CanContinue(phase === 'results')
  }, [phase, setStep1CanContinue])

  useEffect(() => {
    if (phase !== 'scanning') {
      return
    }

    const timer = setTimeout(() => {
      if (scanStep >= 4) {
        setPhase('results')
        return
      }

      setScanStep((prev) => prev + 1)
    }, scanDurations[scanStep])

    return () => clearTimeout(timer)
  }, [phase, scanStep])

  const canScan = selectedRepo !== '' && selectedBranch !== ''

  const handleInstall = () => {
    setPhase('select')
  }

  const handleScan = () => {
    if (!canScan) {
      return
    }

    if (selectedRepo === 'acme-corp/internal-tools') {
      setBlockReason('No requirements.txt found. Crylo requires a requirements.txt to detect your Python dependencies.')
      setPhase('blocked')
      return
    }

    setProjectData((prev) => ({
      ...prev,
      repo: {
        repo: selectedRepo,
        branch: selectedBranch,
      },
    }))
    setScanStep(0)
    setPhase('scanning')
  }

  if (phase === 'connect') {
    return (
      <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
        <div className='mx-auto grid min-h-[260px] max-w-md place-items-center rounded-lg border border-border/70 bg-surface p-6 text-center'>
          <div className='space-y-4'>
            <div className='flex justify-center'>
              <GithubMark />
            </div>
            <h3 className='text-2xl font-semibold tracking-tight'>Connect your GitHub account</h3>
            <p className='text-sm font-normal text-text-muted'>
              Crylo uses a GitHub App to securely access your repository. You choose exactly which repos to grant access to.
            </p>
            <Button variant='primary' onClick={handleInstall}>Install Crylo GitHub App</Button>
            <p className='text-xs font-normal text-text-muted'>Only repositories you explicitly grant access to will be visible</p>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'select') {
    return (
      <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
        <div className='mx-auto max-w-md rounded-lg border border-border/70 bg-surface p-6'>
          <div className='space-y-4'>
            <div>
              <label className='mb-2 block text-sm font-medium text-text-primary'>Repository</label>
              <select
                className='w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                value={selectedRepo}
                onChange={(event) => {
                  setSelectedRepo(event.target.value)
                  setSelectedBranch('')
                }}
              >
                <option value=''>Select a repository...</option>
                <option value='acme-corp/invoiceapp'>acme-corp/invoiceapp</option>
                <option value='acme-corp/analytics-dashboard'>acme-corp/analytics-dashboard</option>
                <option value='acme-corp/internal-tools'>acme-corp/internal-tools</option>
              </select>
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium text-text-primary'>Branch</label>
              <select
                className='w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50'
                value={selectedBranch}
                onChange={(event) => setSelectedBranch(event.target.value)}
                disabled={selectedRepo === ''}
              >
                <option value=''>Select a branch...</option>
                <option value='main'>main</option>
                <option value='staging'>staging</option>
                <option value='develop'>develop</option>
              </select>
            </div>

            <Button variant='primary' className='w-full' onClick={handleScan} disabled={!canScan}>
              Scan repository
            </Button>

            <button
              type='button'
              className='text-xs font-normal text-text-muted hover:text-text-primary'
              onClick={() => setPhase('connect')}
            >
              {'← Change account'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'scanning') {
    const progressPercent = Math.round((scanStep / 4) * 100)

    return (
      <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
        <div className='mx-auto max-w-md rounded-lg border border-border/70 bg-surface p-6'>
          <h3 className='text-lg font-semibold'>Scanning repository</h3>
          <div className='mt-4 space-y-3'>
            {scanMessages.map((item, index) => {
              const isDone = index < scanStep
              const isActive = index === scanStep
              const textClass = isDone
                ? 'text-text-primary'
                : isActive
                  ? 'text-accent'
                  : 'text-text-muted'

              return (
                <div key={item} className='flex items-center gap-3'>
                  {isDone ? (
                    <div className='grid h-4 w-4 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-[10px] text-green-300'>
                      ✓
                    </div>
                  ) : isActive ? (
                    <div className='h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
                  ) : (
                    <div className='h-4 w-4 rounded-full border border-border bg-background' />
                  )}
                  <p className={`text-sm font-normal ${textClass}`}>{item}</p>
                </div>
              )
            })}
          </div>

          <div className='mt-5 h-1.5 overflow-hidden rounded-full bg-background'>
            <div
              className='h-full rounded-full bg-accent transition-all duration-500 ease-out'
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'blocked') {
    return (
      <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
        <div className='mx-auto max-w-md rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-center'>
          <div className='mx-auto grid h-10 w-10 place-items-center rounded-full border border-red-500/30 bg-red-500/10 text-red-300'>
            !
          </div>
          <h3 className='mt-4 text-xl font-semibold'>We couldn\'t analyse this repository</h3>
          <p className='mt-3 text-sm font-normal text-text-muted'>{blockReason}</p>
          <Button variant='secondary' className='mt-5' onClick={() => setPhase('select')}>
            Try a different repository
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
      <div className='rounded-lg border border-border/70 bg-surface p-4'>
        <h3 className='text-lg font-semibold'>Scan complete</h3>

        <div className='mt-5'>
          <h4 className='text-sm font-semibold text-text-primary'>Detected stack</h4>
          <div className='mt-3 grid gap-3 md:grid-cols-2'>
            {detectionItems.map((item) => (
              <div key={`${item.label}-${item.target}`} className='flex rounded-md border border-border bg-background'>
                <div className='w-1 rounded-l-md bg-accent' />
                <div className='flex flex-1 items-center gap-3 p-3'>
                  <div className='grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-xs font-semibold'>
                    {item.mono}
                  </div>
                  <div>
                    <p className='text-sm font-medium text-text-primary'>{item.label}</p>
                    <p className='text-xs font-normal text-text-muted'>{item.target}</p>
                    <p className='text-xs font-normal text-text-muted'>{item.source}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className='mt-6'>
          <h4 className='text-sm font-semibold text-text-primary'>Environment variables</h4>
          <div className='mt-3 overflow-hidden rounded-md border border-border'>
            <table className='w-full text-left text-sm'>
              <thead className='bg-surface'>
                <tr>
                  <th className='px-3 py-2 font-medium text-text-muted'>Variable</th>
                  <th className='px-3 py-2 font-medium text-text-muted'>Classification</th>
                  <th className='px-3 py-2 font-medium text-text-muted'>Source</th>
                </tr>
              </thead>
              <tbody>
                {envRows.map((row) => (
                  <tr key={row.key} className='border-t border-border'>
                    <td className='px-3 py-2 font-medium text-text-primary'>{row.key}</td>
                    <td className='px-3 py-2'>
                      <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusBadgeClass(row.cls)}`}>
                        {row.cls}
                      </span>
                    </td>
                    <td className='px-3 py-2 text-text-muted'>{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className='mt-5 text-xs font-normal text-text-muted'>Draft architecture saved - ready for Step 2</p>
      </div>
    </div>
  )
}

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
  const [step1CanContinue, setStep1CanContinue] = useState(false)

  const canAdvance = (currentStep) => {
    if (currentStep === 1) {
      return step1CanContinue
    }

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

          {step === 1 ? (
            <StepOnePanel
              projectData={projectData}
              setProjectData={setProjectData}
              setStep1CanContinue={setStep1CanContinue}
            />
          ) : (
            <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
              <div className='grid h-full min-h-[260px] place-items-center rounded-lg border border-border/70 bg-surface'>
                <p className='text-sm font-normal text-text-muted'>Step {step} content — coming soon</p>
              </div>
            </div>
          )}
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
