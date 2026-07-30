import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, pollJob } from '../../../../api'

// Step 1 no longer scans the repo — the user runs the /clyro-scan skill with
// their own coding agent, which commits a CLYRO.md contract, and this flow
// ingests it. So "Connect Repository" attempts the ingest immediately: a user
// who already ran the skill lands straight on results, and only one who hasn't
// sees the setup instructions.
export default function useScanFlow({ projectId, projectData, setProjectData, setStep1CanContinue }) {
  const [searchParams] = useSearchParams()
  const [phase, setPhase] = useState(() =>
    projectData.scanResult?.status === 'complete' ? 'results' : 'connect'
  )
  const [selectedRepo, setSelectedRepo] = useState(projectData.repo?.repo || '')
  const [selectedBranch, setSelectedBranch] = useState(projectData.repo?.branch || '')
  const [selectedInstallationId, setSelectedInstallationId] = useState(null)
  const [blockReason, setBlockReason] = useState('')
  const [contractErrors, setContractErrors] = useState([])
  const [rechecking, setRechecking] = useState(false)
  const [scanResult, setScanResult] = useState(() => projectData.scanResult || null)
  const [availableRepos, setAvailableRepos] = useState([])
  const [availableBranches, setAvailableBranches] = useState([])
  const [existingInstallations, setExistingInstallations] = useState([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const repoConnectedRef = useRef(false)

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

  // Ingest CLYRO.md and route to whichever phase the outcome calls for. Shared
  // by the initial connect and every "check again" press, so a retry after the
  // user pushes their contract behaves identically to a first attempt.
  const ingestContract = async () => {
    const { job_id: jobId } = await api.triggerScan(projectId)
    const result = await pollJob(projectId, jobId)

    if (result.status === 'blocked' && result.block_reason === 'clyro_md_missing') {
      setContractErrors(result.contract_drift || [])
      setPhase('contract_missing')
      return
    }

    if (result.status === 'blocked' && result.block_reason === 'clyro_md_invalid') {
      setContractErrors(result.contract_drift || [])
      setPhase('contract_invalid')
      return
    }

    // Anything else blocked is the contract reporting the repo itself as
    // unsupported (no Postgres, not Django) — block_reason carries the message.
    if (result.status === 'blocked' || result.status === 'failed') {
      setBlockReason(result.block_reason || 'Clyro could not read this repository')
      setPhase('blocked')
      return
    }

    setScanResult(result)
    setProjectData((prev) => ({ ...prev, scanResult: result }))
    setPhase('results')
  }

  const handleScan = async () => {
    if (!canScan) return

    setPhase('ingesting')
    setProjectData((prev) => ({ ...prev, repo: { repo: selectedRepo, branch: selectedBranch } }))

    try {
      // connect-repo is idempotent per project, but re-POSTing it on every
      // recheck is pointless work — the repo/branch can't change from here.
      if (!repoConnectedRef.current) {
        await api.connectRepo(projectId, {
          installation_id: parseInt(selectedInstallationId, 10),
          repo_full_name: selectedRepo,
          repo_branch: selectedBranch,
        })
        repoConnectedRef.current = true
      }
      await ingestContract()
    } catch (err) {
      setBlockReason(err.message || 'Failed to read this repository')
      setPhase('blocked')
    }
  }

  // "I've pushed CLYRO.md — check again". Keeps the instructions on screen while
  // it runs rather than flashing through the ingesting phase, so a still-missing
  // contract doesn't look like a different failure.
  const handleRecheck = async () => {
    setRechecking(true)
    try {
      await ingestContract()
    } catch (err) {
      setBlockReason(err.message || 'Failed to read this repository')
      setPhase('blocked')
    } finally {
      setRechecking(false)
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
  const contractMeta = scanResult?.contract_meta || null
  const contractDrift = scanResult?.contract_drift || []

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
    handleRecheck,
    rechecking,
    canScan,
    blockReason,
    contractErrors,
    isMonorepo,
    detectedServices,
    detectedInfra,
    envVars,
    generated,
    userSecrets,
    optional,
    complianceFindings,
    compliancePrompt,
    contractMeta,
    contractDrift,
  }
}
