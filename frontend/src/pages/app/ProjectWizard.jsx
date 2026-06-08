import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import Button from '../../components/ui/Button'
import { api } from '../../api'

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

function StepOnePanel({ projectId, projectData, setProjectData, setStep1CanContinue }) {
  const [searchParams] = useSearchParams()
  const [phase, setPhase] = useState(() =>
    projectData.scanResult?.status === 'complete' ? 'results' : 'connect'
  )
  const [selectedRepo, setSelectedRepo] = useState(projectData.repo?.repo || '')
  const [selectedBranch, setSelectedBranch] = useState(projectData.repo?.branch || '')
  const [selectedInstallationId, setSelectedInstallationId] = useState(null)
  const [scanStep, setScanStep] = useState(0)
  const [scanMessages, setScanMessages] = useState([])
  const [blockReason, setBlockReason] = useState('')
  const [scanResult, setScanResult] = useState(() => projectData.scanResult || null)
  const [availableRepos, setAvailableRepos] = useState([])
  const [availableBranches, setAvailableBranches] = useState([])
  const [existingInstallations, setExistingInstallations] = useState([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const animIntervalRef = useRef(null)

  useEffect(() => {
    const installationId = searchParams.get('installation_id')
    if (installationId) {
      setSelectedInstallationId(installationId)
      setPhase('select')
      fetchRepos(installationId)
    } else {
      api.listInstallations().then(setExistingInstallations).catch(() => {})
    }
  }, [])

  useEffect(() => {
    setStep1CanContinue(phase === 'results')
  }, [phase, setStep1CanContinue])

  const fetchRepos = async (installationId) => {
    setLoadingRepos(true)
    try {
      const repos = await api.listRepos(installationId)
      setAvailableRepos(repos)
    } catch (err) {
      setBlockReason(err.message || 'Failed to fetch repositories')
      setPhase('blocked')
    } finally {
      setLoadingRepos(false)
    }
  }

  const fetchBranches = async (installationId, repoFullName) => {
    setLoadingBranches(true)
    setAvailableBranches([])
    try {
      const branches = await api.listBranches(installationId, repoFullName)
      setAvailableBranches(branches)
    } catch {
      setAvailableBranches([{ name: 'main' }, { name: 'master' }, { name: 'develop' }])
    } finally {
      setLoadingBranches(false)
    }
  }

  const handleInstall = () => {
    if (!projectId) return
    localStorage.setItem('github_install_project_id', projectId)
    const appName = import.meta.env.VITE_GITHUB_APP_NAME
    window.location.href = `https://github.com/apps/${appName}/installations/new`
  }

  const handleUseExisting = (installation) => {
    const id = installation.installation_id.toString()
    setSelectedInstallationId(id)
    setPhase('select')
    fetchRepos(id)
  }

  const handleRepoChange = (repoFullName) => {
    setSelectedRepo(repoFullName)
    setSelectedBranch('')
    setAvailableBranches([])
    if (repoFullName && selectedInstallationId) {
      fetchBranches(selectedInstallationId, repoFullName)
    }
  }

  const canScan = selectedRepo !== '' && selectedBranch !== ''

  const handleScan = async () => {
    if (!canScan) return

    const messages = [
      'Connecting to repository...',
      'Verifying access permissions...',
      'Repository connected!',
      'Scanning file structure...',
      'Reading configuration files...',
      'Detecting services & environment variables...',
      'Generating architecture draft...',
    ]
    setScanMessages(messages)
    setScanStep(0)
    setPhase('scanning')
    setProjectData((prev) => ({ ...prev, repo: { repo: selectedRepo, branch: selectedBranch } }))

    try {
      await api.connectRepo(projectId, {
        installation_id: parseInt(selectedInstallationId, 10),
        repo_full_name: selectedRepo,
        repo_branch: selectedBranch,
      })

      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        setScanStep(i + 1)
      }

      const scanPromise = api.triggerScan(projectId)

      let animStep = 3
      animIntervalRef.current = setInterval(() => {
        animStep++
        if (animStep <= messages.length - 1) {
          setScanStep(animStep)
        } else {
          clearInterval(animIntervalRef.current)
        }
      }, 10000)

      const result = await scanPromise
      clearInterval(animIntervalRef.current)
      setScanStep(messages.length)
      await new Promise((resolve) => setTimeout(resolve, 400))

      if (result.status === 'hard_block') {
        setBlockReason(result.block_reason || 'Repository scan blocked')
        setPhase('blocked')
        return
      }

      if (result.status === 'soft_block') {
        setBlockReason(result.block_reason || 'Scan needs clarification')
        setPhase('blocked')
        return
      }

      setScanResult(result)
      setProjectData((prev) => ({ ...prev, scanResult: result }))
      setPhase('results')
    } catch (err) {
      clearInterval(animIntervalRef.current)
      setBlockReason(err.message || 'Failed to analyse repository')
      setPhase('blocked')
    }
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
              Clyro uses a GitHub App to securely access your repository. You choose exactly which repos to grant access to.
            </p>
            <Button variant='primary' onClick={handleInstall}>Install Clyro GitHub App</Button>
            {existingInstallations.length > 0 && (
              <div className='mt-2 space-y-1'>
                <p className='text-xs font-normal text-text-muted'>or use an existing installation:</p>
                {existingInstallations.map((inst) => (
                  <button
                    key={inst.id}
                    type='button'
                    className='block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary hover:border-accent hover:bg-surface'
                    onClick={() => handleUseExisting(inst)}
                  >
                    {inst.account_login}
                  </button>
                ))}
              </div>
            )}
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
                className='w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50'
                value={selectedRepo}
                disabled={loadingRepos}
                onChange={(event) => handleRepoChange(event.target.value)}
              >
                <option className='text-black' value=''>
                  {loadingRepos ? 'Loading repositories...' : 'Select a repository...'}
                </option>
                {availableRepos.map((repo) => (
                  <option key={repo.full_name} className='text-black' value={repo.full_name}>
                    {repo.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium text-text-primary'>Branch</label>
              <select
                className='w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50'
                value={selectedBranch}
                onChange={(event) => setSelectedBranch(event.target.value)}
                disabled={selectedRepo === '' || loadingBranches}
              >
                <option className='text-black' value=''>
                  {loadingBranches ? 'Loading branches...' : 'Select a branch...'}
                </option>
                {availableBranches.map((b) => (
                  <option key={b.name} className='text-black' value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <Button variant='primary' className='w-full' onClick={handleScan} disabled={!canScan}>
              Connect repository
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
    const total = Math.max(scanMessages.length - 1, 1)
    const progressPercent = Math.round((scanStep / total) * 100)

    return (
      <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
        <div className='mx-auto max-w-md rounded-lg border border-border/70 bg-surface p-6'>
          <h3 className='text-lg font-semibold'>Connecting repository</h3>
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
                    <div className='grid h-4 w-4 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-[10px] text-green-300 shadow-[0_0_8px_rgba(34,197,94,0.2)]'>
                      ✓
                    </div>
                  ) : isActive ? (
                    <div className='h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]' />
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
              className='h-full rounded-full bg-gradient-to-r from-accent/80 to-accent transition-all duration-500 ease-out'
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
          <h3 className='mt-4 text-xl font-semibold'>Connection failed</h3>
          <p className='mt-3 text-sm font-normal text-text-muted'>{blockReason}</p>
          <Button variant='secondary' className='mt-5' onClick={() => setPhase('select')}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  // results phase
  const resources = scanResult?.detected_resources
  const services = resources?.services || {}
  const infra = resources?.infrastructure || {}
  const envVars = scanResult?.env_vars || []
  const isMonorepo = resources?.repository?.is_monorepo

  const detectedServices = [
    services.backend?.detected && `Django backend${services.backend.project_name ? ` (${services.backend.project_name})` : ''}`,
    services.frontend?.detected && 'React frontend',
    services.worker?.detected && `Celery worker${services.worker.scheduled ? ' + scheduled tasks' : ''}`,
  ].filter(Boolean)

  const detectedInfra = [
    infra.database?.detected && 'PostgreSQL',
    infra.cache?.detected && 'Redis cache',
    infra.storage?.detected && 'S3 storage',
    infra.queue?.detected && 'SQS queue',
  ].filter(Boolean)

  const userSecrets = envVars.filter((v) => v.classification === 'user_secret')
  const generated = envVars.filter((v) => v.classification === 'generated')
  const optional = envVars.filter((v) => v.classification === 'optional')

  return (
    <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
      <div className='rounded-lg border border-border/70 bg-surface p-4 space-y-5'>

        <div className='flex rounded-md border border-border bg-background'>
          <div className='w-1 rounded-l-md bg-accent' />
          <div className='flex flex-1 items-center gap-3 p-3'>
            <div className='grid h-9 w-9 place-items-center rounded-md border border-border bg-surface text-xs font-semibold'>GH</div>
            <div>
              <p className='text-sm font-medium text-text-primary'>{selectedRepo}</p>
              <p className='text-xs font-normal text-text-muted'>Branch: {selectedBranch}{isMonorepo != null ? ` · ${isMonorepo ? 'monorepo' : 'single-service'}` : ''}</p>
            </div>
          </div>
        </div>

        {detectedServices.length > 0 && (
          <div>
            <p className='text-xs font-medium text-text-muted uppercase tracking-wide mb-2'>Detected services</p>
            <div className='space-y-1.5'>
              {detectedServices.map((s) => (
                <div key={s} className='flex items-center gap-2 text-sm text-text-primary'>
                  <span className='grid h-4 w-4 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-[10px] text-green-300 shadow-[0_0_8px_rgba(34,197,94,0.2)]'>✓</span>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {detectedInfra.length > 0 && (
          <div>
            <p className='text-xs font-medium text-text-muted uppercase tracking-wide mb-2'>Detected infrastructure</p>
            <div className='space-y-1.5'>
              {detectedInfra.map((s) => (
                <div key={s} className='flex items-center gap-2 text-sm text-text-primary'>
                  <span className='grid h-4 w-4 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-[10px] text-green-300 shadow-[0_0_8px_rgba(34,197,94,0.2)]'>✓</span>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {envVars.length > 0 && (
          <div>
            <p className='text-xs font-medium text-text-muted uppercase tracking-wide mb-2'>Environment variables ({envVars.length} detected)</p>
            <div className='flex flex-wrap gap-2'>
              {generated.length > 0 && (
                <span className='rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs text-green-300'>
                  {generated.length} auto-generated
                </span>
              )}
              {userSecrets.length > 0 && (
                <span className='rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300'>
                  {userSecrets.length} user secret{userSecrets.length > 1 ? 's' : ''}
                </span>
              )}
              {optional.length > 0 && (
                <span className='rounded-full border border-border bg-background px-2.5 py-1 text-xs text-text-muted'>
                  {optional.length} optional
                </span>
              )}
            </div>
          </div>
        )}

        <div className='flex items-center gap-2 pt-1 text-xs font-normal text-text-muted border-t border-border'>
          <span className='grid h-4 w-4 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-[10px] text-green-300 shadow-[0_0_8px_rgba(34,197,94,0.2)]'>✓</span>
          Architecture draft generated — ready for Step 2
        </div>
      </div>
    </div>
  )
}

function StepTwoPanel({ projectId, projectData, setProjectData, setStep2CanContinue }) {
  const hasPostgres = projectData.scanResult?.detected_resources?.infrastructure?.database?.detected ?? true
  const hasWorker = projectData.scanResult?.detected_resources?.services?.worker?.detected ?? false

  const questions = useMemo(() => ([
    {
      id: 'description',
      moment: 1,
      momentLabel: 'About your app',
      question: 'Describe your app in one sentence.',
      type: 'free',
      options: [],
    },
    {
      id: 'scale',
      moment: 1,
      momentLabel: 'About your app',
      question: 'How many users do you expect at launch?',
      type: 'choice',
      options: [
        { value: 'solo', label: 'Just me or a small internal team' },
        { value: 'small', label: 'Small user base — under 1,000 users' },
        { value: 'medium', label: 'Public product — expecting real traffic' },
        { value: 'large', label: 'High scale — expecting significant load' },
      ],
    },
    {
      id: 'criticality',
      moment: 1,
      momentLabel: 'About your app',
      question: 'How critical is uptime for this deployment?',
      type: 'choice',
      options: [
        { value: 'low', label: 'Downtime is acceptable — dev, staging, or side project' },
        { value: 'medium', label: 'Downtime is bad but not catastrophic — early stage product' },
        { value: 'high', label: 'It needs to stay up — this is a production business' },
      ],
    },
    {
      id: 'database_choice',
      moment: 2,
      momentLabel: 'Infrastructure',
      question: 'Which database setup do you want?',
      type: 'choice',
      condition: () => hasPostgres,
      options: [
        { value: 'rds_postgres', label: 'RDS PostgreSQL — reliable, well-understood, lower cost', recommended: true },
        { value: 'aurora_postgres', label: 'Aurora PostgreSQL — higher performance, more scalable', note: 'Higher cost (~2.5×)' },
      ],
    },
    {
      id: 'worker_compute_choice',
      moment: 2,
      momentLabel: 'Infrastructure',
      question: 'Your background workers were detected. Where should they run?',
      type: 'choice',
      condition: () => hasWorker,
      options: [
        { value: 'ecs_fargate', label: 'ECS Fargate — fully managed, no servers to configure', recommended: true },
        { value: 'ecs_ec2', label: 'ECS on EC2 — more control, cheaper at scale' },
        { value: 'ec2', label: 'EC2 — manage the server yourself' },
      ],
    },
    {
      id: 'environment',
      moment: 2,
      momentLabel: 'Infrastructure',
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
      momentLabel: 'Domain',
      question: 'Do you have a domain name for this app?',
      type: 'choice',
      options: [
        { value: 'yes', label: 'Yes — I have a domain to point to this' },
        { value: 'no', label: 'Not yet — give me the AWS-generated URL for now' },
        { value: 'internal', label: 'No public domain needed — internal use only' },
      ],
    },
    {
      id: 'domain_name',
      moment: 3,
      momentLabel: 'Domain',
      question: "What's the domain? (e.g. app.myproduct.com)",
      type: 'free',
      options: [],
      condition: (answers) => answers.domain_has === 'yes',
    },
  ]), [hasPostgres, hasWorker])

  const hasRestoredIntent = !!projectData.intent?.scale
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState(() => projectData.intent || {})
  const [direction, setDirection] = useState('forward')
  const [isComplete, setIsComplete] = useState(hasRestoredIntent)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [cardStage, setCardStage] = useState('idle')
  const [descriptionValue, setDescriptionValue] = useState(projectData.intent?.description || '')
  const [domainValue, setDomainValue] = useState(projectData.intent?.domain_name || '')
  const transitionTimerRef = useRef(null)
  const enterTimerRef = useRef(null)

  useEffect(() => {
    setStep2CanContinue(isComplete && !isSaving)
  }, [isComplete, isSaving, setStep2CanContinue])

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
    }, 120)
  }

  const finalizeIntent = (finalAnswers) => {
    setIsComplete(true)
    setProjectData((prev) => ({ ...prev, intent: finalAnswers }))
    setIsSaving(true)
    setSaveError('')
    api.saveIntent(projectId, { ...finalAnswers, compute_choice: 'ecs_fargate' })
      .then(() => setIsSaving(false))
      .catch((err) => {
        setIsSaving(false)
        setSaveError(err.message || 'Failed to save — your answers may not be persisted')
      })
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

  const optionCardClass = (selected, recommended) => {
    if (selected) return 'border-accent bg-accent-soft/30 shadow-[0_0_0_1px_rgba(249,115,22,0.5),0_0_16px_rgba(249,115,22,0.1)]'
    if (recommended) return 'border-accent/40 bg-background hover:border-accent/70 ring-1 ring-accent/15 shadow-[0_0_0_1px_rgba(249,115,22,0.25)]'
    return 'border-border bg-background hover:border-accent/60 hover:-translate-y-px'
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
        {activeQuestion?.momentLabel && (
          <div className='mb-1 text-[11px] font-semibold uppercase tracking-widest text-accent/70'>
            {activeQuestion.momentLabel}
          </div>
        )}
        <div className='text-xs font-normal text-text-muted'>Question {Math.max(1, questionNumber)} of {Math.max(1, totalVisible)}</div>
        <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-background'>
          <div
            className='h-full rounded-full bg-gradient-to-r from-accent/80 to-accent transition-all duration-500 ease-out'
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
            <div className='flex items-center gap-2'>
              <h3 className='text-2xl font-semibold tracking-tight'>All set</h3>
              {isSaving && <div className='h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent' />}
            </div>
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
            {saveError ? (
              <p className='mt-3 text-xs text-red-400'>{saveError}</p>
            ) : (
              <p className='mt-4 text-xs font-normal text-text-muted'>Intent saved — your architecture is ready to review</p>
            )}
          </div>
        ) : (
          <div className='mt-4 overflow-hidden rounded-lg border border-border/70 bg-surface'>
            <div className={`p-5 transition-all duration-[120ms] ${cardClass()}`}>
              <p className='text-base font-medium text-text-primary'>{activeQuestion.question}</p>

              {activeQuestion.type === 'choice' ? (
                <div className='mt-4 space-y-3'>
                  {activeQuestion.options.map((option) => (
                    <button
                      key={option.value}
                      type='button'
                      onClick={() => handleChoice(option.value)}
                      className={`w-full rounded-lg border p-3 text-left transition-all duration-150 ${optionCardClass(answers[activeQuestion.id] === option.value, option.recommended)}`}
                    >
                      <div className='flex items-center gap-2'>
                        <p className='text-sm font-medium text-text-primary'>{option.label}</p>
                        {option.recommended && (
                          <span className='rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent'>Recommended</span>
                        )}
                      </div>
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

const CHAT_WELCOME = {
  role: 'agent',
  text: 'Your architecture has been generated from your repository scan. You can ask me to explain any component, compare services, or suggest changes.',
}

function StepThreePanel({ projectId, setStep3InputPrefill, step3InputPrefill, step3ShowBanner, onDismissStep3Banner }) {
  const [canvas, setCanvas] = useState(null)
  const [nodePositions, setNodePositions] = useState({})

  const [selectedNode, setSelectedNode] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([CHAT_WELCOME])
  const [agentLoading, setAgentLoading] = useState(false)
  const [pendingOp, setPendingOp] = useState(null)
  const chatEndRef = useRef(null)
  const chatInputRef = useRef(null)
  const surfaceRef = useRef(null)
  const panState = useRef(null)

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

  useEffect(() => {
    if (!projectId) return
    let active = true
    api.getCanvas(projectId)
      .then((res) => {
        if (!active) return
        setCanvas(res.canvas)
        setNodePositions(res.positions || {})
      })
      .catch(() => {})
    // Restore the persisted conversation + any pending Apply so a refresh
    // doesn't lose mid-edit working state.
    api.getCanvasChat(projectId)
      .then((res) => {
        if (!active) return
        if (res.messages && res.messages.length > 0) {
          setChatHistory([CHAT_WELCOME, ...res.messages])
        }
        if (res.pending_operation) {
          setPendingOp(res.pending_operation)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [projectId])

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

  const appendAgent = (text) => setChatHistory((prev) => [...prev, { role: 'agent', text }])

  const applyResult = (res) => {
    if (res.outcome === 'applied' && res.version) {
      setCanvas(res.version.canvas)
      setNodePositions(res.version.positions || {})
      setPendingOp(null)
      appendAgent(res.message || 'Done — I updated the canvas.')
    } else if (res.outcome === 'proposal') {
      setPendingOp(res.operation || null)
      appendAgent(res.message)
    } else {
      setPendingOp(null)
      appendAgent(res.message)
    }
  }

  const handleSend = async () => {
    const message = chatInput.trim()
    if (!message || agentLoading) {
      return
    }

    // chatHistory here is the prior turns (the just-added user message is still
    // queued in state), so it's exactly the conversation context for the agent.
    const priorTurns = chatHistory.slice(-8)
    setChatHistory((prev) => [...prev, { role: 'user', text: message }])
    setChatInput('')
    setAgentLoading(true)
    try {
      const res = await api.canvasAgent(projectId, { prompt: message, history: priorTurns })
      applyResult(res)
    } catch {
      appendAgent('Something went wrong talking to the canvas agent.')
    } finally {
      setAgentLoading(false)
    }
  }

  const confirmProposal = async () => {
    if (!pendingOp || agentLoading) {
      return
    }
    setAgentLoading(true)
    try {
      const res = await api.canvasAgent(projectId, { confirm: true, pending_operation: pendingOp })
      applyResult(res)
    } catch {
      appendAgent('Could not apply the change.')
    } finally {
      setAgentLoading(false)
    }
  }

  const dismissProposal = () => {
    setPendingOp(null)
    appendAgent('Okay, leaving it as is.')
    api.dismissCanvasProposal(projectId).catch(() => {})
  }

  const clearConversation = () => {
    setChatHistory([CHAT_WELCOME])
    setPendingOp(null)
    setSelectedNode(null)
    api.flushCanvasChat(projectId).catch(() => {})
  }

  const canvasNodes = canvas?.nodes || []
  const canvasConnections = canvas?.connections || []
  const canvasCost = canvas?.cost || []
  const totalCost = canvasCost.reduce((sum, item) => sum + item.monthly, 0)
  const selected = canvasNodes.find((node) => node.id === selectedNode) || null

  // Size the surface to the diagram so every node is reachable by panning.
  const surfaceBounds = canvasNodes.reduce(
    (acc, node) => {
      const pos = nodePositions[node.id]
      if (!pos) return acc
      return { width: Math.max(acc.width, pos.x + 220), height: Math.max(acc.height, pos.y + 180) }
    },
    { width: 0, height: 520 },
  )

  // Click-and-drag to pan the canvas (drag-scroll the overflow container).
  const startPan = (event) => {
    if (event.target.closest('button')) return // don't pan when interacting with a node
    const el = surfaceRef.current
    if (!el) return
    panState.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop }
  }
  const movePan = (event) => {
    const el = surfaceRef.current
    if (!panState.current || !el) return
    el.scrollLeft = panState.current.left - (event.clientX - panState.current.x)
    el.scrollTop = panState.current.top - (event.clientY - panState.current.y)
  }
  const endPan = () => {
    panState.current = null
  }

  return (
    <div className='mt-8 mb-6 flex h-[calc(100vh-13rem)] min-h-[420px] gap-4'>
      <div
        ref={surfaceRef}
        className='relative flex-1 cursor-grab select-none overflow-auto rounded-xl border border-border/70 bg-background active:cursor-grabbing'
        onMouseDown={startPan}
        onMouseMove={movePan}
        onMouseUp={endPan}
        onMouseLeave={endPan}
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
            minWidth: `${surfaceBounds.width}px`,
            minHeight: `${surfaceBounds.height}px`,
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
            {canvasConnections.map((connection) => {
              const fromPos = nodePositions[connection.from]
              const toPos = nodePositions[connection.to]
              if (!fromPos || !toPos) return null
              const W = 176
              const H = 74
              const cx1 = fromPos.x + W / 2
              const cy1 = fromPos.y + H / 2
              const cx2 = toPos.x + W / 2
              const cy2 = toPos.y + H / 2
              // Clip the center-to-center line to each card's border so arrows
              // meet the edges of the cards instead of running into them.
              const edge = (cx, cy, tx, ty) => {
                const dx = tx - cx
                const dy = ty - cy
                if (!dx && !dy) return [cx, cy]
                const scale = Math.min(
                  dx ? W / 2 / Math.abs(dx) : Infinity,
                  dy ? H / 2 / Math.abs(dy) : Infinity,
                )
                return [cx + dx * scale, cy + dy * scale]
              }
              const [x1, y1] = edge(cx1, cy1, cx2, cy2)
              const [x2, y2] = edge(cx2, cy2, cx1, cy1)
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

          {canvasNodes.map((node) => {
            const pos = nodePositions[node.id]
            if (!pos) return null
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

          {selected && nodePositions[selected.id] ? (
            <div
              className='absolute z-20 w-56 rounded-lg border border-border bg-surface p-3 shadow-lg'
              style={{ left: `${nodePositions[selected.id].x}px`, top: `${nodePositions[selected.id].y + 68}px` }}
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
            <button
              type='button'
              onClick={clearConversation}
              disabled={agentLoading}
              title='Clear conversation'
              className='ml-auto text-xs text-text-muted transition hover:text-text-primary disabled:opacity-50'
            >
              Clear
            </button>
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
                  {message.role === 'user' ? (
                    message.text
                  ) : (
                    <div className='space-y-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-4 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_a]:underline'>
                      <ReactMarkdown>{message.text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {agentLoading ? (
              <div className='flex justify-start'>
                <div className='rounded-2xl bg-background px-3 py-2 text-sm text-text-muted'>…</div>
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>

          {pendingOp ? (
            <div className='border-t border-border bg-background/40 px-4 py-3'>
              <div className='flex items-center gap-2'>
                <Button variant='primary' size='sm' onClick={confirmProposal} disabled={agentLoading}>
                  Apply change
                </Button>
                <Button variant='ghost' size='sm' onClick={dismissProposal} disabled={agentLoading}>
                  Dismiss
                </Button>
              </div>
            </div>
          ) : null}

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
                disabled={agentLoading}
                className='grid h-9 w-9 place-items-center rounded-md border border-border bg-background text-text-primary transition hover:border-accent hover:text-accent disabled:opacity-50'
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
            {canvasCost.map((item) => (
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

function StepFourPanel({ setStep4CanContinue, onAdvanceToStepFive }) {
  const [phase, setPhase] = useState('aws_connect')
  const [isWaitingRole, setIsWaitingRole] = useState(false)
  const [roleConnected, setRoleConnected] = useState(false)
  const [userSecretVars, setUserSecretVars] = useState([]) // TODO: fetch from GET /api/projects/{id}/env-vars/?classification=user_secret
  const [generatedVars, setGeneratedVars] = useState([])   // TODO: fetch from GET /api/projects/{id}/env-vars/?classification=generated
  const [secretValues, setSecretValues] = useState({})
  const [showSecrets, setShowSecrets] = useState({})
  const [extraVars, setExtraVars] = useState([])
  const [showTemplate, setShowTemplate] = useState(false)
  const [provisioningLog, setProvisioningLog] = useState([]) // TODO: poll GET /api/deployments/{id}/log/
  const [cfTemplate, setCfTemplate] = useState('') // TODO: fetch from GET /api/deployments/{id}/template/
  const [copiedKey, setCopiedKey] = useState('')

  useEffect(() => {
    setStep4CanContinue(phase === 'success')
  }, [phase, setStep4CanContinue])

  const allSecretsFilled = userSecretVars.length === 0 || userSecretVars.every(
    (field) => (secretValues[field.key_name] || '').trim() !== ''
  )

  const handleRoleConnect = () => {
    setIsWaitingRole(true)
    setRoleConnected(false)
    // TODO: call POST /api/projects/{id}/aws-connection/verify/
  }

  const handleCopy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(''), 300)
    } catch {
      setCopiedKey('')
    }
  }

  if (phase === 'aws_connect') {
    return (
      <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
        <div className='mx-auto max-w-2xl rounded-lg border border-border/70 bg-surface p-6 text-center'>
          <div className='mx-auto grid h-12 w-12 place-items-center rounded-full border border-border bg-background'>
            <i className='ti ti-cloud text-lg text-accent' />
          </div>
          <h3 className='mt-4 text-2xl font-semibold tracking-tight'>Connect your AWS account</h3>
          <p className='mt-2 text-sm text-text-muted'>
            Crylo never stores your credentials. It uses a temporary IAM role that you can revoke at any time.
          </p>
          <div className='mx-auto mt-5 max-w-md space-y-2 text-left'>
            {[
              'No access keys or secret keys required',
              'Role can be deleted to immediately revoke access',
              'Same pattern used by Terraform Cloud and Pulumi',
            ].map((item) => (
              <div key={item} className='flex items-center gap-2 text-sm text-text-muted'>
                <i className='ti ti-check text-green-400' />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className='mt-6'>
            <Button variant='primary' onClick={handleRoleConnect} disabled={isWaitingRole || roleConnected}>
              Open AWS CloudFormation console →
            </Button>
          </div>
          {isWaitingRole ? (
            <div className='mt-3 flex items-center justify-center gap-2 text-xs text-text-muted'>
              <div className='h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
              <span>Waiting for role creation...</span>
            </div>
          ) : null}
          {roleConnected ? (
            // TODO: returned from POST /api/projects/{id}/aws-connection/
            <p className='mt-3 text-sm text-green-300'>✓ IAM role connected — </p>
          ) : null}
          {roleConnected ? (
            <Button variant='secondary' className='mt-4' onClick={() => setPhase('env_vars')}>
              Continue →
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (phase === 'env_vars') {
    return (
      <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
        <div className='mx-auto max-w-2xl rounded-lg border border-border/70 bg-surface p-6'>
          <h3 className='text-lg font-semibold'>Values required from you</h3>
          <div className='mt-4 space-y-4'>
            {userSecretVars.map((field) => (
              <div key={field.key_name}>
                <div className='mb-1 flex items-center justify-between'>
                  <p className='text-sm font-semibold text-text-primary'>{field.key_name}</p>
                  {field.context_block ? <p className='text-xs text-text-muted'>{field.context_block}</p> : null}
                </div>
                <div className='flex gap-2'>
                  <input
                    type={showSecrets[field.key_name] ? 'text' : 'password'}
                    value={secretValues[field.key_name] || ''}
                    onChange={(event) => setSecretValues((prev) => ({ ...prev, [field.key_name]: event.target.value }))}
                    className='w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                  />
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => setShowSecrets((prev) => ({ ...prev, [field.key_name]: !prev[field.key_name] }))}
                  >
                    {showSecrets[field.key_name] ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <h3 className='mt-7 text-lg font-semibold'>Auto-generated by Crylo</h3>
          <div className='mt-3 space-y-2'>
            {generatedVars.map((field) => (
              <div key={field.key_name} className='flex items-center justify-between rounded-md border border-border bg-background px-3 py-2'>
                <div>
                  <p className='text-sm font-semibold text-text-primary'>{field.key_name}</p>
                  {field.production_default ? <p className='text-xs text-text-muted'>{field.production_default}</p> : null}
                </div>
                <div className='flex items-center gap-2'>
                  <i className='ti ti-lock text-xs text-text-muted' />
                  <span className='rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs text-green-300'>Auto-generated</span>
                </div>
              </div>
            ))}
          </div>

          <button
            type='button'
            className='mt-4 text-xs text-text-muted hover:text-text-primary'
            disabled={extraVars.length >= 3}
            onClick={() => setExtraVars((prev) => [...prev, { key: '', value: '' }])}
          >
            + Add variable
          </button>
          <div className='mt-2 space-y-2'>
            {extraVars.map((row, index) => (
              <div key={index} className='grid grid-cols-2 gap-2'>
                <input
                  type='text'
                  placeholder='KEY'
                  value={row.key}
                  onChange={(event) => {
                    const next = [...extraVars]
                    next[index] = { ...next[index], key: event.target.value }
                    setExtraVars(next)
                  }}
                  className='rounded-md border border-border bg-background px-3 py-2 text-sm'
                />
                <input
                  type='password'
                  placeholder='VALUE'
                  value={row.value}
                  onChange={(event) => {
                    const next = [...extraVars]
                    next[index] = { ...next[index], value: event.target.value }
                    setExtraVars(next)
                  }}
                  className='rounded-md border border-border bg-background px-3 py-2 text-sm'
                />
              </div>
            ))}
          </div>

          <p className='mt-4 text-xs text-text-muted'>
            Secret values are written directly to AWS Secrets Manager in your account. Crylo never stores them.
          </p>

          <Button variant='primary' className='mt-5' disabled={!allSecretsFilled} onClick={() => setPhase('review')}>
            Save & continue →
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'review') {
    return (
      <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
        <div className='mx-auto max-w-2xl rounded-lg border border-border/70 bg-surface p-6'>
          <h3 className='text-lg font-semibold'>What Clyro will create</h3>
          {/* TODO: derive review summary from canvas_version + intent_record via API */}

          <div className='mt-6'>
            <button
              type='button'
              className='text-sm font-medium text-accent hover:underline'
              onClick={() => setShowTemplate((prev) => !prev)}
            >
              {showTemplate ? 'Hide CloudFormation template ∨' : 'View CloudFormation template ›'}
            </button>
            {showTemplate ? (
              <pre className='mt-3 max-h-48 overflow-y-auto rounded-md border border-border bg-background p-3 text-xs text-text-muted'>
                {cfTemplate}
              </pre>
            ) : null}
          </div>

          <p className='mt-6 text-sm text-amber-300'>
            ⚠ This will create AWS resources in your account. You will be charged by AWS for these resources.
          </p>
          <div className='mt-4 flex items-center gap-4'>
            <button type='button' className='text-sm text-text-muted hover:text-text-primary' onClick={() => setPhase('env_vars')}>
              ← Edit architecture
            </button>
            <Button variant='primary' onClick={() => setPhase('provisioning')}>
              Provision →
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'provisioning') {
    return (
      <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
        <div className='mx-auto max-w-2xl rounded-lg border border-border/70 bg-surface p-6'>
          <h3 className='text-lg font-semibold'>Provisioning infrastructure</h3>
          <div className='mt-4 space-y-3'>
            {provisioningLog.map((entry) => {
              const isDone = entry.status === 'complete'
              const isActive = entry.status === 'in_progress' || entry.status === 'running'
              const textClass = isDone ? 'text-text-primary' : isActive ? 'text-accent' : 'text-text-muted'

              return (
                <div key={entry.sequence} className='flex items-start gap-3'>
                  {isDone ? (
                    <div className='mt-0.5 grid h-4 w-4 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-[10px] text-green-300'>
                      ✓
                    </div>
                  ) : isActive ? (
                    <div className='mt-0.5 h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
                  ) : (
                    <div className='mt-0.5 h-4 w-4 rounded-full border border-border bg-background' />
                  )}
                  <div>
                    <p className={`text-sm ${textClass}`}>{entry.plain_message}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // success phase
  return (
    <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
      <div className='mx-auto max-w-2xl rounded-lg border border-green-500/25 bg-surface p-6'>
        <div className='flex items-center justify-center'>
          <i className='ti ti-circle-check text-[48px] text-green-400' />
        </div>
        <h3 className='mt-4 text-center text-2xl font-semibold tracking-tight'>Your infrastructure is live</h3>

        {/* TODO: fetch from GET /api/deployments/{id}/outputs/ */}
        <div className='mt-6 space-y-2'>
          {[
            ['Frontend URL', '—'],
            ['Backend API', '—'],
            ['CloudFront URL', '—'],
          ].map(([label, value]) => (
            <div key={label} className='flex items-center justify-between rounded-md border border-border bg-background px-3 py-2'>
              <div>
                <p className='text-xs text-text-muted'>{label}</p>
                <p className='text-sm font-medium text-text-primary'>{value}</p>
              </div>
              <button
                type='button'
                className='flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:text-text-primary'
                onClick={() => handleCopy(label, value)}
              >
                <i className='ti ti-copy text-xs' />
                {copiedKey === label ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>

        <div className='mt-6'>
          <h4 className='text-sm font-semibold'>Next steps</h4>
          <div className='mt-2 space-y-2 text-sm text-text-muted'>
            <div className='flex items-start gap-2'><i className='ti ti-arrow-right mt-0.5' /><span>Point your domain DNS to the CloudFront URL above</span></div>
            <div className='flex items-start gap-2'><i className='ti ti-arrow-right mt-0.5' /><span>Set up your CI/CD pipeline to push to ECR on merge to main</span></div>
            <div className='flex items-start gap-2'><i className='ti ti-arrow-right mt-0.5' /><span>Your architecture is saved and visible in the canvas</span></div>
          </div>
        </div>

        <Button
          variant='primary'
          className='mt-6'
          onClick={() => {
            setStep4CanContinue(true)
            onAdvanceToStepFive()
          }}
        >
          Go to dashboard →
        </Button>
      </div>
    </div>
  )
}

function StepFivePanel() {
  const [healthItems, setHealthItems] = useState([]) // TODO: poll GET /api/deployments/{id}/health/
  const [alerts, setAlerts] = useState([]) // TODO: poll GET /api/deployments/{id}/alerts/
  const [stackStatus, setStackStatus] = useState(null) // TODO: fetch from GET /api/deployments/{id}/stack-status/

  const statusIcon = (status) => {
    if (status === 'healthy') return ['ti ti-circle-check', 'text-green-400', 'Healthy']
    if (status === 'degraded') return ['ti ti-alert-triangle', 'text-amber-300', 'Degraded']
    return ['ti ti-circle-x', 'text-red-400', 'Unhealthy']
  }

  return (
    <div className='mt-8 flex-1 overflow-auto rounded-xl border border-border/70 bg-background/40 p-6'>
      <div className='mx-auto w-full max-w-5xl space-y-6'>
        <div>
          <h3 className='text-lg font-semibold'>Health overview</h3>
          <div className='mt-3 grid gap-3 md:grid-cols-3'>
            {healthItems.map(({ name, status, detail }) => {
              const [icon, color, label] = statusIcon(status)
              return (
                <div key={name} className='rounded-lg border border-border bg-surface p-3'>
                  <p className='text-sm font-semibold text-text-primary'>{name}</p>
                  <div className={`mt-2 flex items-center gap-1 text-sm ${color}`}>
                    <i className={icon} />
                    <span>{label}</span>
                  </div>
                  <p className='mt-1 text-xs text-text-muted'>{detail}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h3 className='text-lg font-semibold'>Key metrics</h3>
          <div className='mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4'>
            {[
              ['API response time', '—', ''],
              ['Request rate', '—', ''],
              ['Error rate', '—', ''],
              ['Backend CPU', '—', ''],
            ].map(([title, primary, secondary]) => (
              <div key={title} className='rounded-lg border border-border bg-surface p-3'>
                <p className='text-xs text-text-muted'>{title}</p>
                <p className='mt-2 text-2xl font-semibold'>{primary}</p>
                {secondary ? <p className='mt-1 text-xs text-text-muted'>{secondary}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className='text-lg font-semibold'>Cost</h3>
          <div className='mt-3 grid gap-3 md:grid-cols-3'>
            {[
              ['This month so far', '—'],
              ['Projected', '—'],
              ['Last month', '—'],
            ].map(([k, v]) => (
              <div key={k} className='rounded-lg border border-border bg-surface p-3'>
                <p className='text-xs text-text-muted'>{k}</p>
                <p className='mt-2 text-xl font-semibold text-text-primary'>{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className='flex items-center gap-2'>
            <h3 className='text-lg font-semibold'>Alerts</h3>
            {alerts.length > 0 ? (
              <span className='rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300'>{alerts.length}</span>
            ) : null}
          </div>
          <div className='mt-3 space-y-2'>
            {alerts.map((alert) => (
              <div key={alert.id} className='rounded-lg border border-amber-500/30 border-l-4 border-l-amber-400 bg-surface p-3'>
                <div className='flex items-start gap-2'>
                  <i className='ti ti-alert-triangle text-amber-300 mt-0.5' />
                  <div>
                    <p className='text-sm font-medium text-text-primary'>{alert.plain_message}</p>
                    <p className='mt-1 text-xs text-text-muted'>{alert.fired_at}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {stackStatus ? (
          <div className='rounded-lg border border-border bg-surface p-3'>
            <p className='text-sm text-text-primary'>
              Stack name: <span className='font-semibold'>{stackStatus.stackName}</span>
            </p>
            <p className='mt-1 text-sm text-text-primary'>
              Status: <span className='text-green-400'>{stackStatus.status}</span>
            </p>
            <p className='mt-1 text-xs text-text-muted'>Last updated: {stackStatus.lastUpdated}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const STATUS_STEP = {
  created: 1, repo_connected: 1, scanning: 1, scan_complete: 2,
  intent_collected: 3, canvas_draft: 3, canvas_finalized: 4,
  provisioning: 4, live: 5, failed: 1,
}

const STATUS_ORDER = [
  'created', 'repo_connected', 'scanning', 'scan_complete',
  'intent_collected', 'canvas_draft', 'canvas_finalized',
  'provisioning', 'live',
]

function getCompletedSteps(status) {
  const idx = STATUS_ORDER.indexOf(status)
  const done = new Set()
  if (idx >= 3) done.add(1)
  if (idx >= 4) done.add(2)
  if (idx >= 6) done.add(3)
  if (idx >= 7) done.add(4)
  return done
}

export default function ProjectWizard() {
  const { id } = useParams()
  const navigate = useNavigate()

  const isNew = id === 'new'
  const [projectId, setProjectId] = useState(isNew ? null : id)
  const [projectName, setProjectName] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)
  const [createError, setCreateError] = useState('')
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

  const handleCreateProject = async (e) => {
    e.preventDefault()
    const trimmed = projectName.trim()
    if (!trimmed) return
    setCreatingProject(true)
    setCreateError('')
    try {
      const project = await api.createProject(trimmed)
      setProjectId(project.id)
      navigate(`/app/projects/${project.id}`, { replace: true })
    } catch (err) {
      setCreateError(err.message || 'Failed to create project')
    } finally {
      setCreatingProject(false)
    }
  }

  if (loading) {
    return (
      <div className='flex min-h-[calc(100vh-121px)] items-center justify-center'>
        <div className='h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent' />
      </div>
    )
  }

  if (isNew && !projectId) {
    return (
      <div className='flex min-h-[calc(100vh-121px)] items-center justify-center'>
        <div className='w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-lg shadow-black/30 ring-1 ring-white/[0.06]'>
          <h1 className='text-2xl font-semibold tracking-tight'>New Project</h1>
          <p className='mt-2 text-sm font-normal text-text-muted'>
            Give your project a name to get started.
          </p>
          <form onSubmit={handleCreateProject} className='mt-6 space-y-4'>
            <div>
              <label className='block text-sm font-medium text-text-primary'>Project name</label>
              <input
                className='mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary caret-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
                placeholder='My awesome app'
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                autoFocus
              />
            </div>
            {createError && <p className='text-sm text-red-400'>{createError}</p>}
            <Button
              variant='primary'
              className='w-full'
              type='submit'
              disabled={!projectName.trim() || creatingProject}
            >
              {creatingProject ? 'Creating...' : 'Create Project'}
            </Button>
          </form>
        </div>
      </div>
    )
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

  return (
    <div className='relative min-h-[calc(100vh-121px)]'>
      <h1 className='text-2xl font-semibold tracking-tight'>Project Wizard</h1>

      <div className='fixed inset-x-0 top-[73px] z-20 border-b border-white/[0.06] bg-surface/80 backdrop-blur-md'>
        <div className='mx-auto w-full max-w-6xl px-6 py-4'>
          <div className='flex items-start justify-center gap-6 md:gap-10'>
            {stepConfig.map((item) => {
              const isCompleted = completedSteps.has(item.number)
              const isActive = step === item.number
              const circleClass = isCompleted
                ? 'border-accent bg-accent text-background'
                : isActive
                  ? 'border-accent bg-surface shadow-[0_0_0_4px_rgba(249,115,22,0.15)]'
                  : 'border-border bg-background text-text-muted'
              const labelClass = isActive ? 'font-medium text-text-primary' : 'font-normal text-text-muted'

              return (
                <div key={item.number} className='flex flex-col items-center gap-2'>
                  <div className={`grid h-11 w-11 place-items-center rounded-full border text-sm transition-all duration-300 ${circleClass}`}>
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
        <section className={fullWidth ? 'flex min-h-[calc(100vh-270px)] flex-col' : 'mx-auto flex min-h-[calc(100vh-270px)] w-full max-w-[640px] flex-col'}>
          <div className='w-fit rounded-full border border-border px-3 py-1 text-xs font-normal text-text-muted'>
            Step {step} of 5
          </div>
          <h2 className='mt-4 text-4xl font-semibold tracking-tight'>{currentStepData.title}</h2>
          <p className='mt-3 text-sm font-normal text-text-muted'>{currentStepData.subtitle}</p>

          {step === 1 ? (
            <StepOnePanel
              projectId={projectId}
              projectData={projectData}
              setProjectData={setProjectData}
              setStep1CanContinue={setStep1CanContinue}
            />
          ) : null}

          {step === 2 ? (
            <StepTwoPanel
              projectId={projectId}
              projectData={projectData}
              setProjectData={setProjectData}
              setStep2CanContinue={setStep2CanContinue}
            />
          ) : null}

          {step === 3 ? (
            <StepThreePanel
              projectId={projectId}
              step3InputPrefill={step3InputPrefill}
              setStep3InputPrefill={setStep3InputPrefill}
              step3ShowBanner={step3ShowBanner}
              onDismissStep3Banner={() => setStep3ShowBanner(false)}
            />
          ) : null}

          {step === 4 ? (
            <StepFourPanel
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

          {step === 5 ? <StepFivePanel /> : null}

          {step !== 1 && step !== 2 && step !== 3 && step !== 4 && step !== 5 ? (
            <div className='mt-8 flex-1 rounded-xl border border-dashed border-border bg-background/50 p-6'>
              <div className='grid h-full min-h-[260px] place-items-center rounded-lg border border-border/70 bg-surface'>
                <p className='text-sm font-normal text-text-muted'>Step {step} content — coming soon</p>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className='fixed inset-x-0 bottom-0 z-20 border-t border-white/[0.06] bg-surface/80 backdrop-blur-md'>
        <div className='mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4'>
          <div>
            {step > 1 ? (
              <Button variant='ghost' onClick={handleBack}>
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
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
