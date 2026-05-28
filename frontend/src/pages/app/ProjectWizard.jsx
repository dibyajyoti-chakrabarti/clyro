import { useEffect, useMemo, useRef, useState } from 'react'
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

function StepTwoPanel({ projectData, setProjectData, setStep2CanContinue }) {
  const questions = useMemo(() => ([
    {
      id: 'description',
      moment: 1,
      question: 'Describe your app in one sentence.',
      type: 'free',
      options: [],
    },
    {
      id: 'scale',
      moment: 1,
      question: 'How many users do you expect at launch?',
      type: 'choice',
      options: [
        { value: 'solo', label: 'Just me or a small internal team' },
        { value: 'small', label: 'Small user base - under 1,000 users' },
        { value: 'medium', label: 'Public product - expecting real traffic' },
        { value: 'large', label: 'High scale - expecting significant load' },
      ],
    },
    {
      id: 'criticality',
      moment: 1,
      question: 'How critical is uptime for this deployment?',
      type: 'choice',
      options: [
        { value: 'low', label: 'Downtime is acceptable - dev, staging, or side project' },
        { value: 'medium', label: 'Downtime is bad but not catastrophic - early stage product' },
        { value: 'high', label: 'It needs to stay up - this is a production business' },
      ],
    },
    {
      id: 'compute_choice',
      moment: 2,
      question: 'Your Django backend will run as a container on AWS. Where do you want it hosted?',
      type: 'choice',
      options: [
        { value: 'ecs_fargate', label: 'ECS Fargate - fully managed, no servers to configure', note: 'Recommended for most teams' },
        { value: 'ecs_ec2', label: 'ECS on EC2 - more control, slightly cheaper at high scale', note: 'More operational overhead' },
        { value: 'ec2', label: 'EC2 - you manage the underlying server yourself', note: 'Maximum control, most effort' },
      ],
    },
    {
      id: 'database_choice',
      moment: 2,
      question: 'Which database setup do you want?',
      type: 'choice',
      options: [
        { value: 'rds_postgres', label: 'RDS PostgreSQL - reliable, well-understood, lower cost', note: 'Recommended' },
        { value: 'aurora_postgres', label: 'Aurora PostgreSQL - higher performance, more scalable', note: 'Higher cost (~2.5x)' },
      ],
    },
    {
      id: 'worker_compute_choice',
      moment: 2,
      question: 'Your background workers were detected. Where should they run?',
      type: 'choice',
      options: [
        { value: 'ecs_fargate', label: 'ECS Fargate - same as your backend, fully managed', note: 'Recommended' },
        { value: 'ecs_ec2', label: 'ECS on EC2 - more control, cheaper at scale', note: '' },
        { value: 'ec2', label: 'EC2 - manage the server yourself', note: '' },
      ],
    },
    {
      id: 'environment',
      moment: 2,
      question: 'What environment is this deployment for?',
      type: 'choice',
      options: [
        { value: 'production', label: 'Production' },
        { value: 'staging', label: 'Staging' },
        { value: 'development', label: 'Development' },
      ],
    },
    {
      id: 'domain_has',
      moment: 3,
      question: 'Do you have a domain name for this app?',
      type: 'choice',
      options: [
        { value: 'yes', label: 'Yes - I have a domain to point to this' },
        { value: 'no', label: 'Not yet - give me the AWS-generated URL for now' },
        { value: 'internal', label: 'No public domain needed - internal use only' },
      ],
    },
    {
      id: 'domain_name',
      moment: 3,
      question: "What's the domain? (e.g. app.myproduct.com)",
      type: 'free',
      options: [],
      condition: (answers) => answers.domain_has === 'yes',
    },
  ]), [])

  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState(projectData.intent || {})
  const [direction, setDirection] = useState('forward')
  const [isComplete, setIsComplete] = useState(false)
  const [cardStage, setCardStage] = useState('idle')
  const [descriptionValue, setDescriptionValue] = useState(projectData.intent?.description || '')
  const [domainValue, setDomainValue] = useState(projectData.intent?.domain_name || '')
  const transitionTimerRef = useRef(null)
  const enterTimerRef = useRef(null)

  useEffect(() => {
    setStep2CanContinue(isComplete)
  }, [isComplete, setStep2CanContinue])

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
      if (enterTimerRef.current) {
        clearTimeout(enterTimerRef.current)
      }
    }
  }, [])

  const isVisible = (question, currentAnswers) => {
    if (!question.condition) {
      return true
    }

    return question.condition(currentAnswers)
  }

  const visibleIndexes = questions
    .map((question, index) => (isVisible(question, answers) ? index : -1))
    .filter((index) => index !== -1)

  const safeCurrentQ = isComplete
    ? currentQ
    : (isVisible(questions[currentQ], answers) ? currentQ : visibleIndexes[0] || 0)

  const activeQuestion = isComplete ? null : questions[safeCurrentQ]
  const currentVisiblePosition = isComplete ? visibleIndexes.length : visibleIndexes.indexOf(safeCurrentQ)
  const totalVisible = visibleIndexes.length
  const questionNumber = isComplete ? totalVisible : currentVisiblePosition + 1
  const progressPercent = isComplete ? 100 : Math.round((currentVisiblePosition / totalVisible) * 100)

  const getNextIndex = (fromIndex, nextAnswers) => {
    for (let i = fromIndex + 1; i < questions.length; i += 1) {
      if (isVisible(questions[i], nextAnswers)) {
        return i
      }
    }

    return questions.length
  }

  const getPrevIndex = (fromIndex, nextAnswers) => {
    for (let i = fromIndex - 1; i >= 0; i -= 1) {
      if (isVisible(questions[i], nextAnswers)) {
        return i
      }
    }

    return 0
  }

  const transitionTo = (nextIndex, travelDirection) => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
    }
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current)
    }

    setDirection(travelDirection)
    setCardStage('exit')

    transitionTimerRef.current = setTimeout(() => {
      setCurrentQ(nextIndex)
      setCardStage('enter')

      enterTimerRef.current = setTimeout(() => {
        setCardStage('idle')
      }, 20)
    }, 200)
  }

  const finalizeIntent = (finalAnswers) => {
    setProjectData((prev) => ({
      ...prev,
      intent: finalAnswers,
    }))
    setIsComplete(true)
  }

  const advanceWithAnswers = (nextAnswers) => {
    const nextIndex = getNextIndex(safeCurrentQ, nextAnswers)

    if (nextIndex >= questions.length) {
      finalizeIntent(nextAnswers)
      return
    }

    transitionTo(nextIndex, 'forward')
  }

  const handleChoice = (value) => {
    if (!activeQuestion) {
      return
    }

    const nextAnswers = {
      ...answers,
      [activeQuestion.id]: value,
    }

    setAnswers(nextAnswers)
    setDirection('forward')

    setTimeout(() => {
      advanceWithAnswers(nextAnswers)
    }, 300)
  }

  const handleFreeNext = () => {
    if (!activeQuestion) {
      return
    }

    const value = activeQuestion.id === 'description' ? descriptionValue.trim() : domainValue.trim()
    if (!value) {
      return
    }

    const nextAnswers = {
      ...answers,
      [activeQuestion.id]: value,
    }
    setAnswers(nextAnswers)
    advanceWithAnswers(nextAnswers)
  }

  const handleBack = () => {
    if (isComplete) {
      const fallback = visibleIndexes[visibleIndexes.length - 1] || 0
      setIsComplete(false)
      setDirection('back')
      setCurrentQ(fallback)
      return
    }

    const prevIndex = getPrevIndex(safeCurrentQ, answers)
    if (prevIndex === safeCurrentQ) {
      return
    }

    transitionTo(prevIndex, 'back')
  }

  const optionCardClass = (selected) => {
    if (selected) {
      return 'border-accent bg-accent-soft/30'
    }

    return 'border-border bg-background hover:border-accent/60'
  }

  const cardClass = () => {
    if (cardStage === 'exit') {
      return direction === 'forward' ? '-translate-x-full opacity-0' : 'translate-x-full opacity-0'
    }

    if (cardStage === 'enter') {
      return direction === 'forward' ? 'translate-x-full opacity-0' : '-translate-x-full opacity-0'
    }

    return 'translate-x-0 opacity-100'
  }

  const questionLookup = questions.reduce((acc, q) => {
    acc[q.id] = q
    return acc
  }, {})

  const formatAnswer = (questionId, rawValue) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return '-'
    }

    const question = questionLookup[questionId]
    if (!question || question.type === 'free') {
      return String(rawValue)
    }

    const match = question.options.find((item) => item.value === rawValue)
    return match ? match.label : String(rawValue)
  }

  const summaryQuestions = questions.filter((q) => {
    if (q.id === 'domain_name' && answers.domain_has !== 'yes') {
      return false
    }

    return answers[q.id] !== undefined
  })

  return (
    <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
      <div className='mx-auto max-w-md'>
        <div className='text-xs font-normal text-text-muted'>Question {Math.max(1, questionNumber)} of {Math.max(1, totalVisible)}</div>
        <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-background'>
          <div
            className='h-full rounded-full bg-accent transition-all duration-500 ease-out'
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {!isComplete && currentVisiblePosition > 0 ? (
          <button
            type='button'
            className='mt-4 text-xs font-normal text-text-muted hover:text-text-primary'
            onClick={handleBack}
          >
            {'← Back'}
          </button>
        ) : null}

        {isComplete ? (
          <div className='mt-4 rounded-lg border border-border/70 bg-surface p-5'>
            <h3 className='text-2xl font-semibold tracking-tight'>All set</h3>
            <div className='mt-4 overflow-hidden rounded-md border border-border'>
              <table className='w-full text-left text-sm'>
                <tbody>
                  {summaryQuestions.map((question) => (
                    <tr key={question.id} className='border-t border-border first:border-t-0'>
                      <td className='px-3 py-2 font-medium text-text-muted'>{question.question}</td>
                      <td className='px-3 py-2 text-text-primary'>{formatAnswer(question.id, answers[question.id])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className='mt-4 text-xs font-normal text-text-muted'>Your intent has been saved - your architecture is ready to review</p>
          </div>
        ) : (
          <div className='mt-4 overflow-hidden rounded-lg border border-border/70 bg-surface'>
            <div className={`p-5 transition-all duration-200 ${cardClass()}`}>
              <p className='text-base font-medium text-text-primary'>{activeQuestion.question}</p>

              {activeQuestion.type === 'choice' ? (
                <div className='mt-4 space-y-3'>
                  {activeQuestion.options.map((option) => (
                    <button
                      key={option.value}
                      type='button'
                      onClick={() => handleChoice(option.value)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${optionCardClass(answers[activeQuestion.id] === option.value)}`}
                    >
                      <p className='text-sm font-medium text-text-primary'>{option.label}</p>
                      {option.note ? <p className='mt-1 text-xs font-normal text-text-muted'>{option.note}</p> : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className='mt-4'>
                  {activeQuestion.id === 'description' ? (
                    <textarea
                      className='min-h-[108px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                      placeholder='Tell us what your app does...'
                      value={descriptionValue}
                      onChange={(event) => setDescriptionValue(event.target.value)}
                    />
                  ) : (
                    <input
                      type='text'
                      className='w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                      placeholder='app.myproduct.com'
                      value={domainValue}
                      onChange={(event) => setDomainValue(event.target.value)}
                    />
                  )}

                  <Button
                    variant='primary'
                    className='mt-4'
                    disabled={(activeQuestion.id === 'description' ? descriptionValue : domainValue).trim() === ''}
                    onClick={handleFreeNext}
                  >
                    Next →
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StepThreePanel({ setStep3InputPrefill, step3InputPrefill, step3ShowBanner, onDismissStep3Banner }) {
  const MOCK_CANVAS = {
    nodes: [
      { id: 'backend', label: 'Django backend', type: 'service', aws: 'ECS Fargate', source: 'detected' },
      { id: 'frontend', label: 'React frontend', type: 'static', aws: 'S3 + CloudFront', source: 'detected' },
      { id: 'db', label: 'PostgreSQL', type: 'database', aws: 'RDS PostgreSQL', source: 'detected' },
      { id: 'cache', label: 'Redis cache', type: 'cache', aws: 'ElastiCache', source: 'detected' },
      { id: 'worker', label: 'Celery worker', type: 'worker', aws: 'ECS Fargate', source: 'detected' },
      { id: 'queue', label: 'Task queue', type: 'queue', aws: 'SQS', source: 'detected' },
    ],
    connections: [
      { from: 'frontend', to: 'backend', label: 'REST API' },
      { from: 'backend', to: 'db', label: 'reads/writes' },
      { from: 'backend', to: 'cache', label: 'caching' },
      { from: 'backend', to: 'worker', label: 'async tasks' },
      { from: 'worker', to: 'queue', label: 'consumes' },
    ],
    cost: [
      { label: 'ECS Fargate (backend)', monthly: 34 },
      { label: 'RDS PostgreSQL', monthly: 45 },
      { label: 'ElastiCache Redis', monthly: 16 },
      { label: 'ECS Fargate (worker)', monthly: 18 },
      { label: 'S3 + CloudFront', monthly: 8 },
      { label: 'SQS', monthly: 2 },
      { label: 'ECR storage', monthly: 4 },
    ],
  }

  const POSITIONS = {
    frontend: { x: 80, y: 40 },
    backend: { x: 280, y: 40 },
    db: { x: 480, y: 40 },
    cache: { x: 480, y: 180 },
    worker: { x: 280, y: 220 },
    queue: { x: 80, y: 220 },
  }

  const [selectedNode, setSelectedNode] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([
    {
      role: 'agent',
      text: 'Your architecture has been generated from your repository scan. You can ask me to explain any component, compare services, or suggest changes.',
    },
  ])
  const chatEndRef = useRef(null)
  const chatInputRef = useRef(null)

  useEffect(() => {
    if (!step3InputPrefill) {
      return
    }

    setChatInput(step3InputPrefill)
    if (chatInputRef.current) {
      chatInputRef.current.focus()
    }
    setStep3InputPrefill('')
  }, [step3InputPrefill, setStep3InputPrefill])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatHistory])

  const iconClassByType = {
    service: 'ti ti-server',
    static: 'ti ti-world',
    database: 'ti ti-database',
    cache: 'ti ti-bolt',
    worker: 'ti ti-settings-automation',
    queue: 'ti ti-stack-2',
  }

  const accentByType = {
    service: 'border-l-blue-500',
    static: 'border-l-purple-500',
    database: 'border-l-green-500',
    cache: 'border-l-red-500',
    worker: 'border-l-orange-500',
    queue: 'border-l-yellow-500',
  }

  const replyFor = (message) => {
    const input = message.toLowerCase()

    if (input.includes('aurora')) {
      return 'Aurora PostgreSQL offers better read performance and automatic failover, but costs roughly 2.5× more than RDS for your expected scale. Want me to make the switch?'
    }

    if (input.includes('fargate')) {
      return 'ECS Fargate is fully managed - AWS handles the underlying servers. You define the container, AWS runs it. No patching, no capacity planning.'
    }

    if (input.includes('cost')) {
      return 'Your estimated monthly cost is $127/month. The largest line items are RDS PostgreSQL ($45) and ECS Fargate for the backend ($34).'
    }

    if (input.includes('redis')) {
      return 'Your Django settings use Redis for caching. Removing it would mean cache calls fall back to your database, which may affect performance.'
    }

    return 'I can help you understand, compare, or change any part of this architecture. Try asking about a specific service or asking for suggestions.'
  }

  const handleSend = () => {
    const message = chatInput.trim()
    if (!message) {
      return
    }

    setChatHistory((prev) => [...prev, { role: 'user', text: message }])
    setChatInput('')

    setTimeout(() => {
      setChatHistory((prev) => [...prev, { role: 'agent', text: replyFor(message) }])
    }, 1200)
  }

  const totalCost = MOCK_CANVAS.cost.reduce((sum, item) => sum + item.monthly, 0)
  const selected = MOCK_CANVAS.nodes.find((node) => node.id === selectedNode) || null

  return (
    <div className='mt-8 flex h-full min-h-[540px] gap-4'>
      <div
        className='relative flex-1 overflow-auto rounded-xl border border-border/70 bg-background'
        onClick={() => setSelectedNode(null)}
      >
        {step3ShowBanner ? (
          <div className='sticky top-0 z-20 border-b border-green-500/20 bg-green-500/10 px-4 py-3'>
            <div className='flex items-center justify-between'>
              <p className='text-sm font-medium text-green-300'>Architecture finalized</p>
              <button
                type='button'
                className='text-xs text-green-300/80 hover:text-green-200'
                onClick={(event) => {
                  event.stopPropagation()
                  onDismissStep3Banner()
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        <div
          className='relative min-h-[520px]'
          style={{
            backgroundColor: 'transparent',
            backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <svg className='pointer-events-none absolute inset-0 h-full w-full'>
            <defs>
              <marker id='arrow-head' markerWidth='8' markerHeight='8' refX='6.5' refY='4' orient='auto'>
                <path d='M 0 0 L 8 4 L 0 8 z' className='fill-slate-500/70' />
              </marker>
            </defs>
            {MOCK_CANVAS.connections.map((connection) => {
              const fromPos = POSITIONS[connection.from]
              const toPos = POSITIONS[connection.to]
              const x1 = fromPos.x + 88
              const y1 = fromPos.y + 56
              const x2 = toPos.x + 88
              const y2 = toPos.y
              const midX = (x1 + x2) / 2
              const midY = (y1 + y2) / 2

              return (
                <g key={`${connection.from}-${connection.to}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke='rgba(148, 163, 184, 0.75)'
                    strokeWidth='1.5'
                    markerEnd='url(#arrow-head)'
                  />
                  <text
                    x={midX}
                    y={midY - 4}
                    textAnchor='middle'
                    fontSize='10'
                    fill='rgba(148, 163, 184, 0.9)'
                  >
                    {connection.label}
                  </text>
                </g>
              )
            })}
          </svg>

          {MOCK_CANVAS.nodes.map((node) => {
            const pos = POSITIONS[node.id]
            const isSelected = selectedNode === node.id

            return (
              <button
                key={node.id}
                type='button'
                className={`absolute w-44 rounded-lg border border-border bg-surface px-3 py-2 text-left shadow-sm transition hover:ring-1 hover:ring-accent ${accentByType[node.type]} border-l-4 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedNode(node.id)
                }}
              >
                <div className='flex items-center gap-2'>
                  <i className={`${iconClassByType[node.type]} text-sm text-text-muted`} />
                  <p className='truncate text-sm font-medium text-text-primary'>{node.label}</p>
                </div>
                <div className='mt-3'>
                  <span className='rounded-full border border-border bg-background px-2 py-1 text-xs text-text-muted'>{node.aws}</span>
                </div>
              </button>
            )
          })}

          {selected ? (
            <div
              className='absolute z-20 w-56 rounded-lg border border-border bg-surface p-3 shadow-lg'
              style={{ left: `${POSITIONS[selected.id].x}px`, top: `${POSITIONS[selected.id].y + 68}px` }}
              onClick={(event) => event.stopPropagation()}
            >
              <p className='text-sm font-semibold text-text-primary'>{selected.label}</p>
              <p className='mt-1 text-xs text-text-muted'>Type: {selected.type}</p>
              <p className='text-xs text-text-muted'>AWS: {selected.aws}</p>
              <button
                type='button'
                className='mt-3 text-xs font-medium text-accent hover:underline'
                onClick={() => {
                  setChatInput(`Tell me about the ${selected.label}`)
                  if (chatInputRef.current) {
                    chatInputRef.current.focus()
                  }
                }}
              >
                Ask agent about this →
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className='flex w-80 flex-col overflow-hidden rounded-xl border border-border bg-surface border-l border-l-border'>
        <div className='flex min-h-0 flex-1 flex-col'>
          <div className='flex items-center gap-2 border-b border-border px-4 py-3'>
            <i className='ti ti-sparkles text-sm text-accent' />
            <p className='text-sm font-semibold text-text-primary'>Canvas agent</p>
          </div>

          <div className='min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3'>
            {chatHistory.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-background text-text-primary'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className='border-t border-border p-3'>
            <div className='flex items-center gap-2'>
              <input
                ref={chatInputRef}
                type='text'
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleSend()
                  }
                }}
                className='w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                placeholder='Ask about this architecture...'
              />
              <button
                type='button'
                onClick={handleSend}
                className='grid h-9 w-9 place-items-center rounded-md border border-border bg-background text-text-primary transition hover:border-accent hover:text-accent'
              >
                <i className='ti ti-send text-sm' />
              </button>
            </div>
          </div>
        </div>

        <div className='border-t border-border px-4 py-3'>
          <div className='flex items-center justify-between'>
            <p className='text-sm font-semibold text-text-primary'>Estimated cost</p>
            <p className='text-lg font-semibold text-text-primary'>${totalCost} / month</p>
          </div>
          <div className='mt-3 space-y-1.5'>
            {MOCK_CANVAS.cost.map((item) => (
              <div key={item.label} className='flex items-center justify-between text-xs'>
                <p className='text-text-muted'>{item.label}</p>
                <p className='text-text-primary'>${item.monthly}/mo</p>
              </div>
            ))}
          </div>
          <p className='mt-3 text-xs text-text-muted'>us-east-1 · 730 hrs/month · excl. data transfer</p>
        </div>
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
  const [step2CanContinue, setStep2CanContinue] = useState(false)
  const [step3Finalized, setStep3Finalized] = useState(false)
  const [step3ShowBanner, setStep3ShowBanner] = useState(false)
  const [step3InputPrefill, setStep3InputPrefill] = useState('')

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

    return true
  }

  const currentStepData = stepConfig[step - 1]

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1))
  }

  const handleContinue = () => {
    if (step === 3 && !step3Finalized) {
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

  const fullWidth = step === 3

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
        <section className={fullWidth ? 'flex h-[calc(100vh-270px)] flex-col' : 'mx-auto flex min-h-[calc(100vh-270px)] w-full max-w-[640px] flex-col'}>
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
          ) : null}

          {step === 2 ? (
            <StepTwoPanel
              projectData={projectData}
              setProjectData={setProjectData}
              setStep2CanContinue={setStep2CanContinue}
            />
          ) : null}

          {step === 3 ? (
            <StepThreePanel
              step3InputPrefill={step3InputPrefill}
              setStep3InputPrefill={setStep3InputPrefill}
              step3ShowBanner={step3ShowBanner}
              onDismissStep3Banner={() => setStep3ShowBanner(false)}
            />
          ) : null}

          {step !== 1 && step !== 2 && step !== 3 ? (
            <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
              <div className='grid h-full min-h-[260px] place-items-center rounded-lg border border-border/70 bg-surface'>
                <p className='text-sm font-normal text-text-muted'>Step {step} content — coming soon</p>
              </div>
            </div>
          ) : null}
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
          <Button
            variant='primary'
            onClick={handleContinue}
            disabled={!canAdvance(step) && !(step === 3 && !step3Finalized)}
          >
            {continueLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
