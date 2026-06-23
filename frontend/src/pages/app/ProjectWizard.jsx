import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Database,
  Eye,
  EyeOff,
  FileCode2,
  Globe,
  Layers,
  Lock,
  Plus,
  Rocket,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wand2,
  XCircle,
  Zap,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import { WizardCard, WizardPanel } from '../../components/wizard/WizardPanel'
import StepProgress from '../../components/wizard/StepProgress'
import CfnEditor from '../../components/wizard/CfnEditor'
import githubMark from '../../assets/logos/github-fill.svg'
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

function GithubMark({ size = 'lg' }) {
  const box = size === 'sm' ? 'h-9 w-9 rounded-md' : 'h-14 w-14 rounded-xl'
  const img = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  return (
    <div className={`grid place-items-center border border-border bg-background ${box}`}>
      <img src={githubMark} alt='GitHub' className={img} />
    </div>
  )
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
      <WizardPanel>
        <WizardCard className='text-center'>
          <div className='flex justify-center'>
            <GithubMark />
          </div>
          <h3 className='mt-4 text-xl font-semibold tracking-tight'>Connect your GitHub account</h3>
          <p className='mx-auto mt-2 max-w-sm text-sm font-normal text-text-muted'>
            Clyro uses a GitHub App to securely access your repository. You choose exactly which repos to grant access to.
          </p>
          <Button variant='primary' className='mt-5' onClick={handleInstall}>
            Install Clyro GitHub App
          </Button>

          {existingInstallations.length > 0 && (
            <div className='mt-6 text-left'>
              <div className='flex items-center gap-3'>
                <div className='h-px flex-1 bg-border' />
                <span className='text-xs font-normal text-text-muted'>or use an existing account</span>
                <div className='h-px flex-1 bg-border' />
              </div>
              <div className='mt-3 space-y-1.5'>
                {existingInstallations.map((inst) => (
                  <button
                    key={inst.id}
                    type='button'
                    className='flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary transition-colors hover:border-accent/60 hover:bg-surface'
                    onClick={() => handleUseExisting(inst)}
                  >
                    <GithubMark size='sm' />
                    <span className='truncate'>{inst.account_login}</span>
                    <ArrowRight className='ml-auto h-4 w-4 text-text-muted' />
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className='mt-6 flex items-center justify-center gap-1.5 text-xs font-normal text-text-muted'>
            <ShieldCheck className='h-3.5 w-3.5 text-success' />
            Only repositories you explicitly grant access to will be visible
          </p>
        </WizardCard>
      </WizardPanel>
    )
  }

  if (phase === 'select') {
    return (
      <WizardPanel>
        <WizardCard>
          <button
            type='button'
            className='mb-4 inline-flex items-center gap-1 text-xs font-normal text-text-muted transition-colors hover:text-text-primary'
            onClick={() => setPhase('connect')}
          >
            <ArrowLeft className='h-3.5 w-3.5' />
            Change account
          </button>

          <div className='space-y-4'>
            <Select
              label='Repository'
              value={selectedRepo}
              disabled={loadingRepos}
              placeholder={loadingRepos ? 'Loading repositories…' : 'Select a repository…'}
              options={availableRepos.map((repo) => ({ value: repo.full_name, label: repo.full_name }))}
              onChange={(event) => handleRepoChange(event.target.value)}
            />

            <Select
              label='Branch'
              value={selectedBranch}
              disabled={selectedRepo === '' || loadingBranches}
              placeholder={
                selectedRepo === ''
                  ? 'Select a repository first'
                  : loadingBranches
                    ? 'Loading branches…'
                    : 'Select a branch…'
              }
              options={availableBranches.map((b) => ({ value: b.name, label: b.name }))}
              onChange={(event) => setSelectedBranch(event.target.value)}
            />

            <Button variant='primary' className='w-full' onClick={handleScan} disabled={!canScan}>
              Connect repository
            </Button>
          </div>
        </WizardCard>
      </WizardPanel>
    )
  }

  if (phase === 'scanning') {
    const total = Math.max(scanMessages.length - 1, 1)
    const progressPercent = Math.round((scanStep / total) * 100)

    return (
      <WizardPanel>
        <WizardCard>
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
                    <span className='grid h-5 w-5 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300'>
                      <Check className='h-3 w-3' strokeWidth={3} />
                    </span>
                  ) : isActive ? (
                    <span className='h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent' />
                  ) : (
                    <span className='h-5 w-5 rounded-full border border-border bg-background' />
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
          <p className='mt-2 text-right text-xs text-text-muted'>{progressPercent}%</p>
        </WizardCard>
      </WizardPanel>
    )
  }

  if (phase === 'blocked') {
    return (
      <WizardPanel>
        <WizardCard className='border-danger/30 text-center'>
          <div className='mx-auto grid h-11 w-11 place-items-center rounded-full border border-danger/30 bg-danger/10 text-danger'>
            <AlertTriangle className='h-5 w-5' />
          </div>
          <h3 className='mt-4 text-xl font-semibold'>Connection failed</h3>
          <p className='mx-auto mt-2 max-w-sm text-sm font-normal text-text-muted'>{blockReason}</p>
          <Button variant='secondary' className='mt-5' onClick={() => setPhase('select')}>
            Try again
          </Button>
        </WizardCard>
      </WizardPanel>
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
    <WizardPanel>
      <WizardCard width='lg' className='space-y-5 p-5'>

        <div className='flex items-stretch overflow-hidden rounded-lg border border-border bg-background'>
          <div className='w-1 bg-accent' />
          <div className='flex flex-1 items-center gap-3 p-3'>
            <GithubMark size='sm' />
            <div className='min-w-0'>
              <p className='truncate text-sm font-medium text-text-primary'>{selectedRepo}</p>
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
                  <span className='grid h-4 w-4 shrink-0 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300'><Check className='h-2.5 w-2.5' strokeWidth={3} /></span>
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
                  <span className='grid h-4 w-4 shrink-0 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300'><Check className='h-2.5 w-2.5' strokeWidth={3} /></span>
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
          <span className='grid h-4 w-4 shrink-0 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300'><Check className='h-2.5 w-2.5' strokeWidth={3} /></span>
          Architecture draft generated — ready for Step 2
        </div>
      </WizardCard>
    </WizardPanel>
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
    <WizardPanel>
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
            className='mt-4 inline-flex items-center gap-1 text-xs font-normal text-text-muted transition-colors hover:text-text-primary'
            onClick={handleBack}
          >
            <ArrowLeft className='h-3.5 w-3.5' />
            Back
          </button>
        ) : null}

        {isComplete ? (
          <div className='mt-4 rounded-xl border border-white/[0.07] bg-surface p-5 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04]'>
            <div className='flex items-center gap-2'>
              {isSaving ? (
                <div className='h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent' />
              ) : (
                <span className='grid h-6 w-6 place-items-center rounded-full bg-success/15 text-success'>
                  <Check className='h-3.5 w-3.5' strokeWidth={3} />
                </span>
              )}
              <h3 className='text-xl font-semibold tracking-tight'>{isSaving ? 'Saving your answers…' : 'All set'}</h3>
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
              <p className='mt-3 flex items-center gap-1.5 text-xs text-danger'>
                <AlertTriangle className='h-3.5 w-3.5' />
                {saveError}
              </p>
            ) : !isSaving ? (
              <p className='mt-4 flex items-center gap-1.5 text-xs font-normal text-text-muted'>
                <Check className='h-3.5 w-3.5 text-success' />
                Intent saved — your architecture is ready to review
              </p>
            ) : null}
          </div>
        ) : (
          <div className='mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-surface shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04]'>
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
                      autoFocus
                      className='min-h-[108px] w-full rounded-lg border border-white/[0.09] bg-background px-3.5 py-2.5 text-sm text-text-primary transition-[border-color,box-shadow] duration-150 hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20'
                      placeholder='e.g. A marketplace where photographers sell prints.'
                      value={descriptionValue}
                      onChange={(event) => setDescriptionValue(event.target.value)}
                    />
                  ) : (
                    <input
                      type='text'
                      autoFocus
                      className='w-full rounded-lg border border-white/[0.09] bg-background px-3.5 py-2.5 text-sm text-text-primary transition-[border-color,box-shadow] duration-150 hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20'
                      placeholder='app.myproduct.com'
                      value={domainValue}
                      onChange={(event) => setDomainValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          handleFreeNext()
                        }
                      }}
                    />
                  )}

                  <Button
                    variant='primary'
                    className='mt-4'
                    disabled={(activeQuestion.id === 'description' ? descriptionValue : domainValue).trim() === ''}
                    onClick={handleFreeNext}
                  >
                    Next
                    <ArrowRight className='h-4 w-4' />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </WizardPanel>
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

  const iconByType = {
    service: Server,
    static: Globe,
    database: Database,
    cache: Zap,
    worker: Settings2,
    queue: Layers,
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
    <div className='mt-6 flex h-[calc(100vh-19rem)] min-h-[440px] gap-4'>
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
            {(() => {
              const W = 176
              const H = 74
              // Rectangles for every node, used to route edges around them.
              const nodeRects = canvasNodes
                .map((n) => {
                  const p = nodePositions[n.id]
                  return p ? { id: n.id, x: p.x, y: p.y } : null
                })
                .filter(Boolean)

              // Return the first node (other than the edge's endpoints) whose card
              // the straight segment passes through — sampled along the segment.
              const obstacleFor = (ax, ay, bx, by, skip) => {
                const margin = 6
                for (const r of nodeRects) {
                  if (skip.includes(r.id)) continue
                  const minX = r.x - margin
                  const maxX = r.x + W + margin
                  const minY = r.y - margin
                  const maxY = r.y + H + margin
                  for (let i = 0; i <= 24; i++) {
                    const t = i / 24
                    const px = ax + (bx - ax) * t
                    const py = ay + (by - ay) * t
                    if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
                      return { cx: r.x + W / 2, cy: r.y + H / 2 }
                    }
                  }
                }
                return null
              }

              return canvasConnections.map((connection) => {
                const fromPos = nodePositions[connection.from]
                const toPos = nodePositions[connection.to]
                if (!fromPos || !toPos) return null
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

                // If the straight path crosses another card, bow the edge to the
                // side (quadratic curve) so it routes cleanly around it.
                let cpx = midX
                let cpy = midY
                const obstacle = obstacleFor(x1, y1, x2, y2, [connection.from, connection.to])
                if (obstacle) {
                  const len = Math.hypot(x2 - x1, y2 - y1) || 1
                  const perpX = -(y2 - y1) / len
                  const perpY = (x2 - x1) / len
                  // Bow away from the obstacle's centre (default to one side if it
                  // sits on the line). Offset 240 ≈ a 120px apex — clears a card.
                  const side = (obstacle.cx - midX) * perpX + (obstacle.cy - midY) * perpY
                  const sign = side > 0 ? -1 : 1
                  cpx = midX + sign * 240 * perpX
                  cpy = midY + sign * 240 * perpY
                }
                // Label rides the curve (quadratic midpoint).
                const lx = 0.25 * x1 + 0.5 * cpx + 0.25 * x2
                const ly = 0.25 * y1 + 0.5 * cpy + 0.25 * y2

                return (
                  <g key={`${connection.from}-${connection.to}`}>
                    <path
                      d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
                      fill='none'
                      stroke='rgba(148, 163, 184, 0.75)'
                      strokeWidth='1.5'
                      markerEnd='url(#arrow-head)'
                    />
                    <text
                      x={lx}
                      y={ly - 4}
                      textAnchor='middle'
                      fontSize='10'
                      fill='rgba(148, 163, 184, 0.9)'
                    >
                      {connection.label}
                    </text>
                  </g>
                )
              })
            })()}
          </svg>

          {canvasNodes.map((node) => {
            const pos = nodePositions[node.id]
            if (!pos) return null
            const isSelected = selectedNode === node.id
            const NodeIcon = iconByType[node.type] || Server

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
                  <NodeIcon className='h-4 w-4 shrink-0 text-text-muted' />
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
            <Sparkles className='h-4 w-4 text-accent' />
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
                className='grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-background text-text-primary transition hover:border-accent hover:text-accent disabled:opacity-50'
                aria-label='Send message'
              >
                <Send className='h-4 w-4' />
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

function StepFourPanel({ projectId, setStep4CanContinue, onAdvanceToStepFive }) {
  const [phase, setPhase] = useState('aws_connect')
  const [hydrating, setHydrating] = useState(true)

  // aws_connect phase state
  const [cfnConsoleUrl, setCfnConsoleUrl] = useState(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const [stackOpened, setStackOpened] = useState(false)
  const [arnInput, setArnInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState(null)
  const [roleConnected, setRoleConnected] = useState(false)

  // env_vars phase state
  const [envVarsLoading, setEnvVarsLoading] = useState(false)
  const [userSecretVars, setUserSecretVars] = useState([])
  const [generatedVars, setGeneratedVars] = useState([])
  const [secretValues, setSecretValues] = useState({})
  const [showSecrets, setShowSecrets] = useState({})
  const [extraVars, setExtraVars] = useState([])
  const [savingEnvVars, setSavingEnvVars] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // iac phase state
  const [iacTemplate, setIacTemplate] = useState('')
  const [iacValidation, setIacValidation] = useState(null)
  const [iacGenerating, setIacGenerating] = useState(false)
  const [iacRefining, setIacRefining] = useState(false)
  const [iacValidating, setIacValidating] = useState(false)
  const [iacError, setIacError] = useState(null)
  const [iacReady, setIacReady] = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const [refineHistory, setRefineHistory] = useState([])
  const iacGenStartedRef = useRef(false)

  // provisioning phase state
  const [provisioningLog, setProvisioningLog] = useState([])
  const [deployStatus, setDeployStatus] = useState(null)
  const [deployError, setDeployError] = useState(null)
  const [stackOutputs, setStackOutputs] = useState([])
  const deployPollRef = useRef(null)

  // shared
  const [showTemplate, setShowTemplate] = useState(false)
  const [copiedKey, setCopiedKey] = useState('')

  useEffect(() => {
    setStep4CanContinue(phase === 'success')
  }, [phase, setStep4CanContinue])

  // Hydrate the Step-4 phase + template from the backend on mount so a refresh
  // resumes where the user left off: it must not re-prompt the role stack, and
  // must not regenerate (and thereby lose) an already-authored template. getIac
  // 400s until AWS is connected, so a successful response implies a connection;
  // a non-empty template means generation already happened.
  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    const hydrate = async () => {
      try {
        const data = await api.getIac(projectId)
        if (cancelled) return
        setRoleConnected(true)
        if (data.template) {
          setIacTemplate(data.template)
          setIacValidation(data.validation || null)
          setIacReady(data.status === 'iac_ready')
          setPhase('iac')
        } else {
          // Connected but nothing authored yet — skip to iac (which auto-generates)
          // only if the secrets were already saved; otherwise resume at env_vars.
          let envSaved = false
          try {
            const env = await api.getEnvVars(projectId)
            const secrets = env.user_secret || []
            envSaved = secrets.length > 0 && secrets.every((v) => v.secrets_manager_arn)
          } catch { /* fall through to env_vars */ }
          if (!cancelled) setPhase(envSaved ? 'iac' : 'env_vars')
        }
      } catch {
        if (!cancelled) setPhase('aws_connect')  // AWS not connected yet
      } finally {
        if (!cancelled) setHydrating(false)
      }
    }
    hydrate()
    return () => { cancelled = true }
  }, [projectId])

  // Fetch the CloudFormation console URL only when the user actually needs the
  // connect step — avoids minting a spurious pending connection on every refresh
  // once the account is already connected.
  useEffect(() => {
    if (hydrating || phase !== 'aws_connect' || !projectId || roleConnected || cfnConsoleUrl) return
    setUrlLoading(true)
    api.initAwsConnection(projectId)
      .then((data) => setCfnConsoleUrl(data.cfn_console_url))
      .catch(() => {})
      .finally(() => setUrlLoading(false))
  }, [hydrating, phase, projectId, roleConnected, cfnConsoleUrl])

  // Fetch env vars when entering env_vars phase
  useEffect(() => {
    if (phase !== 'env_vars' || !projectId) return
    setEnvVarsLoading(true)
    api.getEnvVars(projectId)
      .then((data) => {
        setUserSecretVars(data.user_secret || [])
        setGeneratedVars(data.generated || [])
      })
      .catch(() => {})
      .finally(() => setEnvVarsLoading(false))
  }, [phase, projectId])

  const allSecretsFilled = userSecretVars.length === 0 || userSecretVars.every(
    (field) => (secretValues[field.key_name] || '').trim() !== ''
  )

  const handleOpenStack = () => {
    if (cfnConsoleUrl) {
      window.open(cfnConsoleUrl, '_blank', 'noopener,noreferrer')
      setStackOpened(true)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setVerifyError(null)
    try {
      await api.verifyAwsConnection(projectId, { role_arn: arnInput.trim(), region: 'us-east-1' })
      setRoleConnected(true)
    } catch (err) {
      setVerifyError(err.data?.error || 'Verification failed — check the role ARN and try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleSaveEnvVars = async () => {
    setSavingEnvVars(true)
    setSaveError(null)
    try {
      await api.saveEnvVars(projectId, { values: secretValues, extra_vars: extraVars })
      setPhase('iac')
    } catch (err) {
      setSaveError(err.data?.error || 'Failed to save secrets — please try again.')
    } finally {
      setSavingEnvVars(false)
    }
  }

  const runGenerate = async () => {
    setIacGenerating(true)
    setIacError(null)
    try {
      const data = await api.generateIac(projectId)
      setIacTemplate(data.template || '')
      setIacValidation(data.validation || null)
      setIacReady(data.status === 'iac_ready')
      if (data.message) {
        setRefineHistory((prev) => [...prev, { role: 'assistant', text: data.message }])
      }
    } catch (err) {
      setIacError(err.data?.error || 'Failed to generate the template.')
    } finally {
      setIacGenerating(false)
    }
  }

  // Generate the template once when the iac phase is entered. A ref guards against
  // re-running (the effect deps change as generation toggles state); on failure the
  // user retries explicitly rather than auto-looping and hammering the agent.
  useEffect(() => {
    if (phase !== 'iac') {
      iacGenStartedRef.current = false
      return
    }
    if (!projectId || iacTemplate || iacGenStartedRef.current) return
    iacGenStartedRef.current = true
    runGenerate()
  }, [phase, projectId, iacTemplate])

  const handleRefine = async () => {
    const instruction = refineInput.trim()
    if (!instruction || iacRefining) return
    setIacRefining(true)
    setIacError(null)
    setRefineHistory((prev) => [...prev, { role: 'user', text: instruction }])
    setRefineInput('')
    try {
      // Send the current editor content so the agent refines what the user sees
      // (manual edits included), not a stale server copy.
      const data = await api.refineIac(projectId, { instruction, history: refineHistory, template: iacTemplate })
      if (data.outcome === 'answer') {
        // A question — the agent answered without touching the template.
        setRefineHistory((prev) => [...prev, { role: 'assistant', text: data.message || '' }])
      } else {
        setIacTemplate(data.template || '')
        setIacValidation(data.validation || null)
        setIacReady(data.status === 'iac_ready')
        setRefineHistory((prev) => [...prev, { role: 'assistant', text: data.message || 'Updated the template.' }])
      }
    } catch (err) {
      setIacError(err.data?.error || 'Failed to refine the template.')
    } finally {
      setIacRefining(false)
    }
  }

  const handleValidate = async () => {
    setIacValidating(true)
    setIacError(null)
    try {
      const data = await api.validateIac(projectId, { template: iacTemplate })
      setIacValidation(data.validation || null)
      setIacReady(data.status === 'iac_ready')
    } catch (err) {
      setIacError(err.data?.error || 'Validation failed — please try again.')
    } finally {
      setIacValidating(false)
    }
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

  // ── Provisioning (Step 4.5): submit + poll the live CFN feed ──────────────
  const stopDeployPoll = () => {
    if (deployPollRef.current) {
      clearInterval(deployPollRef.current)
      deployPollRef.current = null
    }
  }

  const pollDeployOnce = async () => {
    try {
      const data = await api.getDeployStatus(projectId)
      setProvisioningLog(data.log || [])
      setDeployStatus(data.status)
      setStackOutputs(data.outputs || [])
      if (data.error) setDeployError(data.error)
      if (data.status === 'complete') {
        stopDeployPoll()
        setPhase('success')
      } else if (data.status === 'failed' || data.status === 'rolled_back') {
        stopDeployPoll()
      }
    } catch (err) {
      setDeployError(err.data?.error || null)  // transient — keep polling
    }
  }

  const startDeployPoll = () => {
    stopDeployPoll()
    pollDeployOnce()
    deployPollRef.current = setInterval(pollDeployOnce, 4000)
  }

  const handleProvision = async () => {
    setDeployError(null)
    setProvisioningLog([])
    setStackOutputs([])
    setDeployStatus('submitting')
    setPhase('provisioning')
    try {
      await api.startDeploy(projectId)
      startDeployPoll()
    } catch (err) {
      setDeployError(err.data?.error || 'Failed to start provisioning.')
      setDeployStatus('failed')
    }
  }

  // Stop polling if the panel unmounts mid-deploy.
  useEffect(() => () => stopDeployPoll(), [])

  if (hydrating) {
    return (
      <WizardPanel>
        <WizardCard width='lg' className='text-center'>
          <span className='mx-auto block h-6 w-6 rounded-full border-2 border-current border-t-transparent animate-spin' />
          <p className='mt-4 text-sm text-text-muted'>Loading your progress…</p>
        </WizardCard>
      </WizardPanel>
    )
  }

  if (phase === 'aws_connect') {
    return (
      <WizardPanel>
        <WizardCard width='lg' className='text-center'>
          <div className='mx-auto grid h-12 w-12 place-items-center rounded-full border border-border bg-background'>
            <Cloud className='h-5 w-5 text-accent' />
          </div>
          <h3 className='mt-4 text-xl font-semibold tracking-tight'>Connect your AWS account</h3>
          <p className='mx-auto mt-2 max-w-md text-sm text-text-muted'>
            Crylo never stores your credentials. It uses a temporary IAM role that you can revoke at any time.
          </p>
          <div className='mx-auto mt-5 max-w-md space-y-2 text-left'>
            {[
              'No access keys or secret keys required',
              'Role can be deleted to immediately revoke access',
              'Same pattern used by Terraform Cloud and Pulumi',
            ].map((item) => (
              <div key={item} className='flex items-center gap-2 text-sm text-text-muted'>
                <Check className='h-4 w-4 shrink-0 text-success' />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className='mt-6'>
            <Button variant='primary' onClick={handleOpenStack} disabled={urlLoading || !cfnConsoleUrl || roleConnected}>
              {urlLoading ? (
                <>
                  <span className='h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin' />
                  Preparing…
                </>
              ) : (
                <>
                  Open AWS CloudFormation console
                  <ArrowRight className='h-4 w-4' />
                </>
              )}
            </Button>
          </div>

          {stackOpened && !roleConnected ? (
            <div className='mx-auto mt-6 w-full max-w-md text-left'>
              <ol className='mb-3 space-y-1 text-sm text-text-muted list-none'>
                <li className='flex items-start gap-2'>
                  <span className='shrink-0 font-semibold text-accent'>1.</span>
                  Wait for the stack status to show <strong className='text-text-primary'>CREATE_COMPLETE</strong> (≈30s)
                </li>
                <li className='flex items-start gap-2'>
                  <span className='shrink-0 font-semibold text-accent'>2.</span>
                  Click the <strong className='text-text-primary'>Outputs</strong> tab in the CloudFormation console
                </li>
                <li className='flex items-start gap-2'>
                  <span className='shrink-0 font-semibold text-accent'>3.</span>
                  Copy the value next to <strong className='text-text-primary'>RoleArn</strong> — it starts with <code className='text-xs bg-white/5 px-1 py-0.5 rounded'>arn:aws:iam::</code>
                </li>
              </ol>
              <div className='flex gap-2'>
                <input
                  type='text'
                  placeholder='arn:aws:iam::123456789012:role/clyro-provisioning-…'
                  value={arnInput}
                  onChange={(e) => setArnInput(e.target.value)}
                  className='w-full rounded-lg border border-white/[0.09] bg-background px-3.5 py-2.5 text-sm text-text-primary transition-[border-color,box-shadow] duration-150 hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20'
                />
                <Button
                  variant='secondary'
                  disabled={!arnInput.trim() || verifying}
                  onClick={handleVerify}
                >
                  {verifying ? (
                    <span className='h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin' />
                  ) : 'Verify'}
                </Button>
              </div>
              {verifyError ? (
                <p className='mt-2 text-xs text-red-400'>{verifyError}</p>
              ) : null}
            </div>
          ) : null}

          {roleConnected ? (
            <p className='mt-4 flex items-center justify-center gap-1.5 text-sm text-success'>
              <Check className='h-4 w-4' strokeWidth={3} />
              IAM role connected
            </p>
          ) : null}
          {roleConnected ? (
            <Button variant='secondary' className='mt-4' onClick={() => setPhase('env_vars')}>
              Continue
              <ArrowRight className='h-4 w-4' />
            </Button>
          ) : null}
        </WizardCard>
      </WizardPanel>
    )
  }

  if (phase === 'env_vars') {
    return (
      <WizardPanel>
        <WizardCard width='lg'>
          {envVarsLoading ? (
            <div className='flex items-center justify-center py-12 gap-2 text-sm text-text-muted'>
              <span className='h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
              Loading environment variables…
            </div>
          ) : (
            <>
              <div>
                <h3 className='text-lg font-semibold'>Values required from you</h3>
                <p className='mt-1 text-sm text-text-muted'>These secrets are needed to run your app. Fill in each one to continue.</p>
              </div>
              <div className='mt-4 space-y-4'>
                {userSecretVars.length === 0 ? (
                  <p className='text-sm text-text-muted italic'>No required secrets detected.</p>
                ) : userSecretVars.map((field) => (
                  <div key={field.key_name}>
                    <div className='mb-1 flex items-center justify-between gap-3'>
                      <p className='text-sm font-semibold text-text-primary'>{field.key_name}</p>
                      {field.context_block ? <p className='text-xs text-text-muted'>{field.context_block}</p> : null}
                    </div>
                    <div className='flex gap-2'>
                      <input
                        type={showSecrets[field.key_name] ? 'text' : 'password'}
                        value={secretValues[field.key_name] || ''}
                        onChange={(event) => setSecretValues((prev) => ({ ...prev, [field.key_name]: event.target.value }))}
                        className='w-full rounded-lg border border-white/[0.09] bg-background px-3.5 py-2.5 text-sm text-text-primary transition-[border-color,box-shadow] duration-150 hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20'
                      />
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => setShowSecrets((prev) => ({ ...prev, [field.key_name]: !prev[field.key_name] }))}
                        aria-label={showSecrets[field.key_name] ? 'Hide value' : 'Show value'}
                      >
                        {showSecrets[field.key_name] ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {generatedVars.length > 0 ? (
                <>
                  <h3 className='mt-7 text-lg font-semibold'>Auto-generated by Crylo</h3>
                  <p className='mt-1 text-sm text-text-muted'>Crylo creates and manages these for you — no action needed.</p>
                  <div className='mt-3 space-y-2'>
                    {generatedVars.map((field) => (
                      <div key={field.key_name} className='flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2'>
                        <div>
                          <p className='text-sm font-semibold text-text-primary'>{field.key_name}</p>
                          {field.production_default ? <p className='text-xs text-text-muted'>{field.production_default}</p> : null}
                        </div>
                        <div className='flex items-center gap-2'>
                          <Lock className='h-3.5 w-3.5 text-text-muted' />
                          <span className='rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs text-green-300'>Auto-generated</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              <button
                type='button'
                className='mt-4 inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary disabled:opacity-40'
                disabled={extraVars.length >= 3}
                onClick={() => setExtraVars((prev) => [...prev, { key: '', value: '' }])}
              >
                <Plus className='h-3.5 w-3.5' />
                Add variable
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
                      className='rounded-lg border border-white/[0.09] bg-background px-3.5 py-2.5 text-sm text-text-primary hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20'
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
                      className='rounded-lg border border-white/[0.09] bg-background px-3.5 py-2.5 text-sm text-text-primary hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20'
                    />
                  </div>
                ))}
              </div>

              <p className='mt-4 flex items-start gap-1.5 text-xs text-text-muted'>
                <ShieldCheck className='mt-0.5 h-3.5 w-3.5 shrink-0 text-success' />
                Secret values are written directly to AWS Secrets Manager in your account. Crylo never stores them.
              </p>

              {saveError ? (
                <p className='mt-3 text-xs text-red-400'>{saveError}</p>
              ) : null}

              <Button
                variant='primary'
                className='mt-5'
                disabled={!allSecretsFilled || savingEnvVars}
                onClick={handleSaveEnvVars}
              >
                {savingEnvVars ? (
                  <>
                    <span className='h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin' />
                    Saving…
                  </>
                ) : (
                  <>
                    Save & continue
                    <ArrowRight className='h-4 w-4' />
                  </>
                )}
              </Button>
            </>
          )}
        </WizardCard>
      </WizardPanel>
    )
  }

  if (phase === 'iac') {
    const errors = iacValidation?.errors ?? 0
    const warnings = iacValidation?.warnings ?? 0
    const isValid = iacValidation?.is_valid
    const inputClass = 'w-full rounded-lg border border-white/[0.09] bg-surface px-3 py-2 text-sm text-text-primary transition-[border-color,box-shadow] duration-150 hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20 disabled:opacity-50'
    return (
      <WizardPanel>
        <WizardCard width='full'>
          <div>
            <h3 className='flex items-center gap-2 text-lg font-semibold'>
              <FileCode2 className='h-5 w-5 text-accent' />
              Review your infrastructure
            </h3>
            <p className='mt-1 text-sm text-text-muted'>
              Clyro generated this CloudFormation template from your architecture. Edit it directly or ask for changes, then validate before provisioning.
            </p>
          </div>

          {iacGenerating && !iacTemplate ? (
            <div className='flex items-center justify-center gap-2 py-24 text-sm text-text-muted'>
              <span className='h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
              Generating your CloudFormation template…
            </div>
          ) : (!iacTemplate && iacError) ? (
            <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
              <AlertTriangle className='h-6 w-6 text-red-400' />
              <p className='max-w-md text-sm text-red-300'>{iacError}</p>
              <Button variant='secondary' onClick={runGenerate}>
                Retry generation
              </Button>
            </div>
          ) : (
            <div className='mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]'>
              <div className='flex flex-col'>
                <div className='h-[680px] overflow-hidden rounded-lg border border-white/[0.09]'>
                  <CfnEditor
                    value={iacTemplate}
                    onChange={(v) => { setIacTemplate(v); setIacReady(false) }}
                    markers={iacValidation?.diagnostics || []}
                    readOnly={iacRefining}
                  />
                </div>
                <div className='mt-3 flex items-center justify-between gap-3'>
                  <div className='flex items-center gap-3 text-sm'>
                    {iacValidation == null ? (
                      <span className='text-text-muted'>Not validated yet</span>
                    ) : isValid ? (
                      <span className='flex items-center gap-1.5 text-success'>
                        <Check className='h-4 w-4' strokeWidth={3} />
                        Valid{warnings ? ` · ${warnings} warning${warnings > 1 ? 's' : ''}` : ''}
                      </span>
                    ) : (
                      <span className='flex items-center gap-1.5 text-red-400'>
                        <AlertTriangle className='h-4 w-4' />
                        {errors} error{errors > 1 ? 's' : ''}{warnings ? ` · ${warnings} warning${warnings > 1 ? 's' : ''}` : ''}
                      </span>
                    )}
                  </div>
                  <Button variant='secondary' size='sm' onClick={handleValidate} disabled={iacValidating || iacRefining || !iacTemplate}>
                    {iacValidating ? (
                      <span className='h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin' />
                    ) : 'Validate'}
                  </Button>
                </div>
              </div>

              <div className='flex flex-col rounded-lg border border-white/[0.09] bg-background'>
                <div className='border-b border-white/[0.07] px-3 py-2'>
                  <p className='flex items-center gap-1.5 text-sm font-semibold'>
                    <Wand2 className='h-4 w-4 text-accent' />
                    Ask Clyro to change it
                  </p>
                </div>
                <div className='flex-1 space-y-3 overflow-y-auto px-3 py-3' style={{ maxHeight: '596px' }}>
                  {refineHistory.length === 0 ? (
                    <p className='text-xs text-text-muted'>
                      e.g. “make the database multi-AZ”, “increase the backend to 2 tasks”, “add an alarm for SQS backlog”.
                    </p>
                  ) : refineHistory.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[92%] rounded-lg px-3 py-2 text-xs ${m.role === 'user' ? 'bg-accent/15 text-text-primary' : 'bg-white/[0.04] text-text-muted'}`}>
                        {m.role === 'user' ? (
                          m.text
                        ) : (
                          <div className='space-y-2 [&_p]:m-0 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-4 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_a]:underline'>
                            <ReactMarkdown>{m.text}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {iacRefining ? (
                    <div className='flex items-center gap-2 text-xs text-text-muted'>
                      <span className='h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin' />
                      Updating the template…
                    </div>
                  ) : null}
                </div>
                <div className='border-t border-white/[0.07] p-2'>
                  <div className='flex gap-2'>
                    <input
                      type='text'
                      value={refineInput}
                      onChange={(e) => setRefineInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRefine() }}
                      placeholder='Describe a change…'
                      disabled={iacRefining}
                      className={inputClass}
                    />
                    <Button variant='secondary' size='sm' onClick={handleRefine} disabled={iacRefining || !refineInput.trim()}>
                      <Send className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {iacError ? <p className='mt-3 text-xs text-red-400'>{iacError}</p> : null}

          <div className='mt-5 flex items-center gap-4'>
            <button
              type='button'
              className='inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary'
              onClick={() => setPhase('env_vars')}
            >
              <ArrowLeft className='h-4 w-4' />
              Back
            </button>
            <Button variant='primary' disabled={!iacReady} onClick={() => setPhase('review')}>
              Continue
              <ArrowRight className='h-4 w-4' />
            </Button>
            {!iacReady ? <span className='text-xs text-text-muted'>Validate the template to continue.</span> : null}
          </div>
        </WizardCard>
      </WizardPanel>
    )
  }

  if (phase === 'review') {
    return (
      <WizardPanel>
        <WizardCard width='lg'>
          <h3 className='text-lg font-semibold'>What Clyro will create</h3>

          <div className='mt-6'>
            <button
              type='button'
              className='text-sm font-medium text-accent hover:underline'
              onClick={() => setShowTemplate((prev) => !prev)}
            >
              {showTemplate ? 'Hide CloudFormation template' : 'View CloudFormation template'}
            </button>
          </div>

          <p className='mt-6 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
            This will create AWS resources in your account. You will be charged by AWS for these resources.
          </p>
          <div className='mt-4 flex items-center gap-4'>
            <button
              type='button'
              className='inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary'
              onClick={() => setPhase('iac')}
            >
              <ArrowLeft className='h-4 w-4' />
              Edit template
            </button>
            <Button variant='primary' onClick={handleProvision}>
              Provision
              <ArrowRight className='h-4 w-4' />
            </Button>
          </div>
        </WizardCard>
      </WizardPanel>
    )
  }

  if (phase === 'provisioning') {
    const deployFailed = deployStatus === 'failed' || deployStatus === 'rolled_back'
    return (
      <WizardPanel>
        <WizardCard width='lg'>
          <div className='flex items-center gap-2'>
            {deployFailed ? (
              <XCircle className='h-5 w-5 text-red-400' />
            ) : (
              <span className='h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
            )}
            <h3 className='text-lg font-semibold'>
              {deployFailed ? 'Provisioning failed' : 'Provisioning infrastructure'}
            </h3>
          </div>
          {!deployFailed ? (
            <p className='mt-1 text-sm text-text-muted'>This typically takes 8–12 minutes — you can keep this tab open.</p>
          ) : null}

          <div className='mt-4 space-y-3'>
            {provisioningLog.length === 0 ? (
              <p className='text-sm text-text-muted'>Submitting your template to AWS…</p>
            ) : provisioningLog.map((entry) => {
              const isDone = entry.status === 'done'
              const isActive = entry.status === 'in_progress'
              const isFailed = entry.status === 'failed'
              const textClass = isFailed ? 'text-red-300' : isDone ? 'text-text-primary' : isActive ? 'text-accent' : 'text-text-muted'

              return (
                <div key={entry.sequence} className='flex items-start gap-3'>
                  {isFailed ? (
                    <span className='mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-red-500/40 bg-red-500/15 text-red-300'>
                      <XCircle className='h-3.5 w-3.5' />
                    </span>
                  ) : isDone ? (
                    <span className='mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300'>
                      <Check className='h-3 w-3' strokeWidth={3} />
                    </span>
                  ) : isActive ? (
                    <span className='mt-0.5 h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin' />
                  ) : (
                    <span className='mt-0.5 h-5 w-5 rounded-full border border-border bg-background' />
                  )}
                  <p className={`text-sm ${textClass}`}>{entry.plain_message}</p>
                </div>
              )
            })}
          </div>

          {deployFailed ? (
            <div className='mt-5'>
              {deployError ? (
                <p className='flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300'>
                  <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
                  {deployError}
                </p>
              ) : null}
              <div className='mt-4 flex items-center gap-4'>
                <button
                  type='button'
                  className='inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary'
                  onClick={() => setPhase('review')}
                >
                  <ArrowLeft className='h-4 w-4' />
                  Back
                </button>
                <Button variant='primary' onClick={handleProvision}>
                  Retry
                  <ArrowRight className='h-4 w-4' />
                </Button>
              </div>
            </div>
          ) : null}
        </WizardCard>
      </WizardPanel>
    )
  }

  // success phase
  return (
    <WizardPanel>
      <WizardCard width='lg' className='border-green-500/25'>
        <div className='flex items-center justify-center'>
          <CheckCircle2 className='h-12 w-12 text-green-400' />
        </div>
        <h3 className='mt-4 text-center text-xl font-semibold tracking-tight'>Your infrastructure is live</h3>

        <div className='mt-6 space-y-2'>
          {stackOutputs.length === 0 ? (
            <p className='text-center text-sm text-text-muted'>No stack outputs were returned.</p>
          ) : stackOutputs.map((o) => (
            <div key={o.key} className='flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2'>
              <div className='min-w-0'>
                <p className='text-xs text-text-muted'>{o.description || o.key}</p>
                <p className='truncate text-sm font-medium text-text-primary'>{o.value}</p>
              </div>
              <button
                type='button'
                className='flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted transition-colors hover:border-accent/60 hover:text-text-primary'
                onClick={() => handleCopy(o.key, o.value)}
              >
                <Copy className='h-3 w-3' />
                {copiedKey === o.key ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>

        <div className='mt-6'>
          <h4 className='text-sm font-semibold'>Next steps</h4>
          <div className='mt-2 space-y-2 text-sm text-text-muted'>
            {[
              'Point your domain DNS to the CloudFront URL above',
              'Set up your CI/CD pipeline to push to ECR on merge to main',
              'Your architecture is saved and visible in the canvas',
            ].map((tip) => (
              <div key={tip} className='flex items-start gap-2'>
                <ArrowRight className='mt-0.5 h-4 w-4 shrink-0 text-text-muted' />
                <span>{tip}</span>
              </div>
            ))}
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
          Go to dashboard
          <ArrowRight className='h-4 w-4' />
        </Button>
      </WizardCard>
    </WizardPanel>
  )
}

function StepFivePanel() {
  const [healthItems, setHealthItems] = useState([]) // TODO: poll GET /api/deployments/{id}/health/
  const [alerts, setAlerts] = useState([]) // TODO: poll GET /api/deployments/{id}/alerts/
  const [stackStatus, setStackStatus] = useState(null) // TODO: fetch from GET /api/deployments/{id}/stack-status/

  const statusIcon = (status) => {
    if (status === 'healthy') return [CheckCircle2, 'text-green-400', 'Healthy']
    if (status === 'degraded') return [AlertTriangle, 'text-amber-300', 'Degraded']
    return [XCircle, 'text-red-400', 'Unhealthy']
  }

  return (
    <div className='mt-6 flex-1 overflow-auto rounded-xl border border-white/[0.07] bg-background/40 p-6'>
      <div className='mx-auto w-full max-w-5xl space-y-6'>
        <div>
          <h3 className='text-lg font-semibold'>Health overview</h3>
          {healthItems.length === 0 ? (
            <p className='mt-3 rounded-lg border border-dashed border-border bg-surface/40 px-4 py-6 text-center text-sm text-text-muted'>
              Waiting for the first health check to report…
            </p>
          ) : (
            <div className='mt-3 grid gap-3 md:grid-cols-3'>
              {healthItems.map(({ name, status, detail }) => {
                const [Icon, color, label] = statusIcon(status)
                return (
                  <div key={name} className='rounded-lg border border-border bg-surface p-3'>
                    <p className='text-sm font-semibold text-text-primary'>{name}</p>
                    <div className={`mt-2 flex items-center gap-1 text-sm ${color}`}>
                      <Icon className='h-4 w-4' />
                      <span>{label}</span>
                    </div>
                    <p className='mt-1 text-xs text-text-muted'>{detail}</p>
                  </div>
                )
              })}
            </div>
          )}
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
            {alerts.length === 0 ? (
              <p className='flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm text-text-muted'>
                <CheckCircle2 className='h-4 w-4 text-success' />
                No active alerts — everything looks healthy.
              </p>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className='rounded-lg border border-amber-500/30 border-l-4 border-l-amber-400 bg-surface p-3'>
                  <div className='flex items-start gap-2'>
                    <AlertTriangle className='mt-0.5 h-4 w-4 text-amber-300' />
                    <div>
                      <p className='text-sm font-medium text-text-primary'>{alert.plain_message}</p>
                      <p className='mt-1 text-xs text-text-muted'>{alert.fired_at}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
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
        <div className='w-full max-w-xl'>
          <div className='overflow-hidden rounded-2xl border border-white/[0.08] bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.45)]'>
            <div className='border-b border-white/[0.06] bg-gradient-to-b from-accent/[0.08] to-transparent px-8 pt-8 pb-7'>
              <div className='grid h-12 w-12 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent'>
                <Rocket className='h-6 w-6' />
              </div>
              <h1 className='mt-5 text-2xl font-semibold tracking-tight'>Name your project</h1>
              <p className='mt-2 max-w-md text-sm text-text-muted'>
                We&apos;ll connect your repo, detect your stack, and generate cloud infrastructure tailored to it — in five guided steps.
              </p>
            </div>

            <form onSubmit={handleCreateProject} className='px-8 py-7'>
              <label htmlFor='project-name' className='block text-sm font-medium text-text-primary'>
                Project name
              </label>
              <input
                id='project-name'
                className='mt-1.5 w-full rounded-lg border border-white/[0.09] bg-background px-3.5 py-2.5 text-sm text-text-primary caret-accent transition-[border-color,box-shadow] duration-150 hover:border-white/[0.15] focus-visible:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20'
                placeholder='My awesome app'
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                autoFocus
              />
              {createError ? (
                <p className='mt-2 flex items-center gap-1.5 text-sm text-danger'>
                  <AlertTriangle className='h-3.5 w-3.5' />
                  {createError}
                </p>
              ) : null}
              <Button
                variant='primary'
                className='mt-5 w-full'
                size='lg'
                type='submit'
                disabled={!projectName.trim() || creatingProject}
              >
                {creatingProject ? 'Creating…' : 'Create project'}
                {!creatingProject ? <ArrowRight className='h-4 w-4' /> : null}
              </Button>
            </form>
          </div>

          <div className='mt-5 px-2'>
            <p className='text-[11px] font-semibold uppercase tracking-widest text-text-muted'>What happens next</p>
            <ol className='mt-3 grid gap-2 sm:grid-cols-2'>
              {stepConfig.map((item) => (
                <li key={item.number} className='flex items-center gap-2.5 text-sm text-text-muted'>
                  <span className='grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border bg-background text-[11px] font-semibold text-text-muted'>
                    {item.number}
                  </span>
                  <span className='truncate'>{item.title}</span>
                </li>
              ))}
            </ol>
          </div>
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
  // Step 4 (IaC editor) wants the wide working surface like step 3, but keeps the
  // outer scroll its taller phases rely on (fullWidth steps manage their own).
  const wideStep = step === 4
  const totalSteps = stepConfig.length

  return (
    <div className='flex min-h-[calc(100vh-121px)] overflow-hidden rounded-2xl border border-white/[0.07] bg-surface/20'>
      {/* Left rail — vertical step guide (desktop) */}
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
            Step {step} of {totalSteps} · <span className='text-text-primary'>{currentStepData.title}</span>
          </p>
          <div className='mt-2 h-1 overflow-hidden rounded-full bg-background'>
            <div
              className='h-full rounded-full bg-accent transition-all duration-500'
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className={`flex min-h-0 flex-1 flex-col ${fullWidth ? 'p-4 sm:p-6' : wideStep ? 'overflow-y-auto p-4 sm:p-6' : 'overflow-y-auto px-6 py-8 sm:px-10 sm:py-10'}`}>
          <header className={fullWidth ? 'shrink-0' : ''}>
            <h2 className='text-2xl font-semibold tracking-tight sm:text-3xl'>{currentStepData.title}</h2>
            <p className='mt-2 max-w-2xl text-sm text-text-muted'>{currentStepData.subtitle}</p>
          </header>

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
              projectId={projectId}
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
        </div>

        {/* Footer nav — in-flow, no blur */}
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
