import { useEffect, useRef, useState } from 'react'
import { api } from '../../../../api'
import ConfirmDialog from '../../../../components/ui/ConfirmDialog'
import { WizardCard } from '../../../../components/wizard/WizardPanel'
import DeploymentSuccess from './DeploymentSuccess'
import ProvisionLog from './ProvisionLog'
import ProvisioningBackground from './ProvisioningBackground'
import ReviewArchitecture from './ReviewArchitecture'
import SecretsWrite from './SecretsWrite'

// Deployment statuses that describe a stack the provisioning screen can show.
// Anything else (iac_ready, pending) means we haven't submitted yet.
//
// 'deleting' belongs here: a teardown takes 5 to 10 minutes, and a refresh
// during one used to land back on the review screen offering to provision a
// stack that was busy being destroyed.
const DEPLOY_PHASE_STATUSES = [
  'submitting', 'in_progress', 'rolling_back', 'building', 'complete',
  'failed', 'rolled_back', 'build_failed', 'deleting',
]

// Step 6: review the generated template, write the staged secrets for real
// (now that AWS is connected), then provision. AWS connection (Step 2) and IaC
// generation (Step 5) are both already done by the time we get here.
function StepSixPanel({ projectId, onBackToIac, onAdvanceToStepSeven }) {
  const [phase, setPhase] = useState('review')
  const [hydrating, setHydrating] = useState(true)

  // review phase state
  const [iacTemplate, setIacTemplate] = useState('')

  // provisioning phase state
  const [provisioningLog, setProvisioningLog] = useState([])
  const [deployStatus, setDeployStatus] = useState(null)
  const [deployError, setDeployError] = useState(null)
  const [deployCorrecting, setDeployCorrecting] = useState(false)
  const [stackOutputs, setStackOutputs] = useState([])
  const [canRecreate, setCanRecreate] = useState(false)
  const deployPollRef = useRef(null)
  const deployLogSinceRef = useRef(null)
  const provisionJobIdRef = useRef(null)

  // infra lifecycle (pause / resume / delete) state
  const [infraActionLoading, setInfraActionLoading] = useState(false)
  const [infraActionError, setInfraActionError] = useState(null)
  const [teardownOpen, setTeardownOpen] = useState(false)
  const [recreateOpen, setRecreateOpen] = useState(false)

  // shared
  const [copiedKey, setCopiedKey] = useState('')

  // Hydrate the template + deployment phase from the backend on mount so a
  // refresh resumes where the user left off — a submitted/live/build-failed
  // deployment must resume into the provisioning/success screen, not fall
  // back to the review screen. Found live: after a teardown the deployment is
  // `deleted`, which is neither `iac_ready` nor `complete` — it rendered the
  // old provisioning log with no controls at all, so a torn-down project
  // could never be provisioned again from the UI.
  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    const hydrate = async () => {
      try {
        const data = await api.getIac(projectId)
        if (cancelled) return
        if (data.template) setIacTemplate(data.template)

        let deployData = null
        try {
          deployData = await api.getDeployStatus(projectId)
        } catch { /* no submitted deployment yet — fall through to review */ }

        if (!cancelled && deployData && DEPLOY_PHASE_STATUSES.includes(deployData.status)) {
          const log = deployData.log || []
          setProvisioningLog(log)
          deployLogSinceRef.current = log.length ? Math.max(...log.map((entry) => entry.sequence ?? -1)) : null
          setDeployStatus(deployData.status)
          setStackOutputs(deployData.outputs || [])
          setCanRecreate(Boolean(deployData.can_recreate))
          if (deployData.error) setDeployError(deployData.error)
          if (deployData.status === 'complete') {
            setPhase('success')
          } else {
            setPhase('provisioning')
            if (['submitting', 'in_progress', 'rolling_back', 'building', 'deleting'].includes(deployData.status)) {
              startDeployPoll()
            }
          }
        } else if (!cancelled) {
          setPhase('review')
        }
      } catch {
        if (!cancelled) setPhase('review')
      } finally {
        if (!cancelled) setHydrating(false)
      }
    }
    hydrate()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const handleCopy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(''), 300)
    } catch {
      setCopiedKey('')
    }
  }

  // ── Provisioning: submit + poll the live CFN feed ─────────────────────────
  const stopDeployPoll = () => {
    if (deployPollRef.current) {
      clearInterval(deployPollRef.current)
      deployPollRef.current = null
    }
  }

  const pollDeployOnce = async () => {
    try {
      const data = await api.getDeployStatus(projectId, deployLogSinceRef.current)
      const nextLog = data.log || []
      if (nextLog.length) {
        setProvisioningLog((prev) => {
          const seen = new Set(prev.map((entry) => entry.sequence))
          const merged = [...prev, ...nextLog.filter((entry) => !seen.has(entry.sequence))]
          deployLogSinceRef.current = Math.max(...merged.map((entry) => entry.sequence ?? -1))
          return merged
        })
      }
      setDeployStatus(data.status)
      setStackOutputs(data.outputs || [])
      setCanRecreate(Boolean(data.can_recreate))
      if (data.error) setDeployError(data.error)

      if (data.status === 'complete') {
        stopDeployPoll()
        setPhase('success')
        return
      }

      // Teardown terminates here. Without this the poll had no branch for
      // 'deleted', so it kept hitting the backend every 4s forever, and a
      // teardown started from the success screen left that screen showing the
      // live endpoints of a stack that no longer exists.
      if (data.status === 'deleted') {
        stopDeployPoll()
        setStackOutputs([])
        setDeployError(null)
        setPhase('provisioning')
        return
      }

      // Mid-teardown: same screen, but the success view must step aside for it.
      if (data.status === 'deleting') {
        setStackOutputs([])
        setDeployError(null)
        setPhase('provisioning')
        return
      }

      // The infrastructure itself came up clean, but nothing has built the
      // customer's code into it yet — keep polling (same job_id, same
      // endpoint) through the build phase; ProvisionLog.jsx shows a distinct
      // "Building your application…" state for this, not the success screen.
      if (data.status === 'build_failed') {
        setDeployCorrecting(false)
        stopDeployPoll()
        return
      }

      // A raw 'failed'/'rolled_back' CFN status isn't necessarily terminal —
      // the backend's provision_with_feedback job may still be mid one-round
      // auto-correction (real AWS error -> refine -> retry). Only stop polling
      // once the SUPERVISING JOB itself reaches a terminal state; that's the
      // actual authority on whether this attempt is really done.
      if (data.status === 'failed' || data.status === 'rolled_back') {
        if (!provisionJobIdRef.current) {
          stopDeployPoll()  // no job to consult (shouldn't happen) — stop safely
          return
        }
        const job = await api.getJobStatus(projectId, provisionJobIdRef.current)
        if (job.status === 'running' || job.status === 'pending') {
          setDeployCorrecting(true)  // still mid auto-correction — keep polling
          return
        }
        setDeployCorrecting(false)
        stopDeployPoll()
        if (job.status === 'failed') setDeployError(job.error || deployError)
      } else {
        setDeployCorrecting(false)
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
    setDeployCorrecting(false)
    setProvisioningLog([])
    deployLogSinceRef.current = null
    setStackOutputs([])
    setDeployStatus('submitting')
    setPhase('provisioning')
    try {
      const { job_id: jobId } = await api.startDeploy(projectId)
      provisionJobIdRef.current = jobId
      startDeployPoll()
    } catch (err) {
      setDeployError(err.data?.error || 'Failed to start provisioning.')
      setDeployStatus('failed')
    }
  }

  const handleRetryBuild = async () => {
    // Deliberately does NOT call handleProvision — the CFN stack is already
    // CREATE_COMPLETE and must not be resubmitted, only the build step needs
    // to run again (deploy_retry_build on the backend, not deploy_start).
    setDeployError(null)
    setPhase('provisioning')
    try {
      const { job_id: jobId } = await api.retryBuild(projectId)
      provisionJobIdRef.current = jobId
      startDeployPoll()
    } catch (err) {
      setDeployError(err.data?.error || 'Failed to retry the build.')
    }
  }

  // Stop polling if the panel unmounts mid-deploy.
  useEffect(() => () => stopDeployPoll(), [])

  // ── Infra lifecycle: pause (reversible scale-to-zero) / resume / delete ────
  const handlePause = async () => {
    setInfraActionError(null)
    setInfraActionLoading(true)
    try {
      const data = await api.pauseDeploy(projectId)
      setDeployStatus(data.status)
    } catch (err) {
      setInfraActionError(err.data?.error || 'Failed to pause infrastructure.')
    } finally {
      setInfraActionLoading(false)
    }
  }

  const handleResume = async () => {
    setInfraActionError(null)
    setInfraActionLoading(true)
    try {
      const data = await api.resumeDeploy(projectId)
      setDeployStatus(data.status)
    } catch (err) {
      setInfraActionError(err.data?.error || 'Failed to resume infrastructure.')
    } finally {
      setInfraActionLoading(false)
    }
  }

  const handleTeardown = () => {
    setInfraActionError(null)
    setTeardownOpen(true)
  }

  const confirmTeardown = async () => {
    setInfraActionLoading(true)
    try {
      const data = await api.teardownDeploy(projectId)
      setDeployStatus(data.status)
      setTeardownOpen(false)
      // Leave the success screen immediately: its endpoints and "your
      // infrastructure is live" copy describe a stack that is now being
      // destroyed. ProvisionLog owns the deleting/deleted states.
      setStackOutputs([])
      setDeployError(null)
      setPhase('provisioning')
      startDeployPoll()
    } catch (err) {
      setInfraActionError(err.data?.error || 'Failed to delete infrastructure.')
      setTeardownOpen(false)
    } finally {
      setInfraActionLoading(false)
    }
  }

  const teardownDialog = (
    <ConfirmDialog
      open={teardownOpen}
      title='Delete infrastructure'
      description='This permanently deletes all provisioned infrastructure for this project: the CloudFormation stack and every resource it created. This cannot be undone.'
      confirmText={infraActionLoading ? 'Deleting…' : 'Yes, delete infrastructure'}
      onCancel={() => setTeardownOpen(false)}
      onConfirm={confirmTeardown}
    />
  )

  // Rebuild from scratch: teardown + a fresh provision (deploy.recreate). Offered
  // only when the backend says can_recreate (a failed, never-been-live deploy), so
  // destroying the stack loses nothing. Confirmed because it is still destructive.
  const handleRecreate = () => {
    setInfraActionError(null)
    setRecreateOpen(true)
  }

  const confirmRecreate = async () => {
    setRecreateOpen(false)
    setDeployError(null)
    setDeployCorrecting(false)
    setCanRecreate(false)
    setProvisioningLog([])
    deployLogSinceRef.current = null
    setStackOutputs([])
    setDeployStatus('submitting')
    setPhase('provisioning')
    try {
      const { job_id: jobId } = await api.recreateDeploy(projectId)
      provisionJobIdRef.current = jobId
      startDeployPoll()
    } catch (err) {
      setDeployError(err.data?.error || 'Failed to start the rebuild.')
      setDeployStatus('failed')
    }
  }

  const recreateDialog = (
    <ConfirmDialog
      open={recreateOpen}
      title='Rebuild from scratch'
      description='This deletes the current failed infrastructure and provisions it again from a clean slate, applying the latest fixes. Nothing has gone live yet, so no data is lost, but the current stack is destroyed and rebuilt. This can take 10 to 15 minutes.'
      confirmText='Yes, rebuild from scratch'
      onCancel={() => setRecreateOpen(false)}
      onConfirm={confirmRecreate}
    />
  )

  if (hydrating) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center p-8'>
        <WizardCard width='lg' className='text-center'>
          <span className='mx-auto block h-6 w-6 rounded-full border-2 border-current border-t-transparent animate-spin' />
          <p className='mt-4 text-sm text-text-muted'>Loading your progress…</p>
        </WizardCard>
      </div>
    )
  }

  if (phase === 'review') {
    return (
      <div className='flex flex-1 flex-col overflow-y-auto p-8'>
        <ReviewArchitecture
          cfTemplate={iacTemplate}
          onEditArchitecture={onBackToIac}
          onProvision={() => setPhase('secrets')}
        />
      </div>
    )
  }

  if (phase === 'secrets') {
    return (
      <div className='flex flex-1 flex-col overflow-y-auto p-8'>
        <SecretsWrite projectId={projectId} onDone={handleProvision} />
      </div>
    )
  }

  if (phase === 'provisioning') {
    return (
      <>
        {/* Sibling of (not nested inside) the scrollable content wrapper below,
            so its `absolute inset-0` resolves against the Step 6 section — the
            entire right-side panel — rather than being clipped to this inner,
            padded, overflow-y-auto wrapper. */}
        <ProvisioningBackground />
        <div className='relative z-10 flex flex-1 flex-col overflow-y-auto p-8'>
          <ProvisionLog
            provisioningLog={provisioningLog}
            deployStatus={deployStatus}
            deployError={deployError}
            deployCorrecting={deployCorrecting}
            onRetry={handleProvision}
            onRetryBuild={handleRetryBuild}
            onBack={() => setPhase('review')}
            onCancel={handleTeardown}
            cancelLoading={infraActionLoading}
            cancelError={infraActionError}
            canRecreate={canRecreate}
            onRecreate={handleRecreate}
          />
          {teardownDialog}
          {recreateDialog}
        </div>
      </>
    )
  }

  // success phase
  return (
    <div className='flex flex-1 flex-col overflow-y-auto p-8'>
      <DeploymentSuccess
        stackOutputs={stackOutputs}
        copiedKey={copiedKey}
        onCopy={handleCopy}
        onGoToDashboard={onAdvanceToStepSeven}
        deployStatus={deployStatus}
        infraActionLoading={infraActionLoading}
        infraActionError={infraActionError}
        onPause={handlePause}
        onResume={handleResume}
        onTeardown={handleTeardown}
      />
      {teardownDialog}
    </div>
  )
}

export default StepSixPanel
