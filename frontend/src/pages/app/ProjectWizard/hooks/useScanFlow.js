import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, pollJob } from '../../../../api'

export default function useScanFlow({ projectId, projectData, setProjectData, setStep1CanContinue }) {
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
    const hasBlockingFindings = (scanResult?.compliance_findings || []).some(
      (f) => !f.passed && f.severity === 'blocker'
    )
    setStep1CanContinue(phase === 'results' && !hasBlockingFindings)
  }, [phase, scanResult, setStep1CanContinue])

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
      setAvailableBranches(branches.map((branch) => branch.name))
    } catch {
      setAvailableBranches(['main', 'master', 'develop'])
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

      const scanPromise = api.triggerScan(projectId).then(({ job_id: jobId }) => pollJob(projectId, jobId))

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

  const complianceFindings = scanResult?.compliance_findings || []
  const compliancePrompt = scanResult?.compliance_prompt || null

  return {
    phase,
    setPhase,
    selectedRepo,
    selectedBranch,
    loadingRepos,
    loadingBranches,
    availableRepos,
    availableBranches,
    existingInstallations,
    handleInstall,
    handleUseExisting,
    handleRepoChange,
    setSelectedBranch,
    handleScan,
    canScan,
    blockReason,
    scanMessages,
    scanStep,
    isMonorepo,
    detectedServices,
    detectedInfra,
    envVars,
    generated,
    userSecrets,
    optional,
    complianceFindings,
    compliancePrompt,
  }
}
