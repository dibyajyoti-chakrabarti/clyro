import { useEffect, useRef, useState } from 'react'
import { api, pollJob } from '../../../../api'
import ConfirmDialog from '../../../../components/ui/ConfirmDialog'
import { WizardCard } from '../../../../components/wizard/WizardPanel'
import DeploymentSuccess from './DeploymentSuccess'
import IacEditor from './IacEditor'
import ProvisionLog from './ProvisionLog'
import ReviewArchitecture from './ReviewArchitecture'

// Deployment statuses that describe a stack the provisioning screen can show.
// Anything else (iac_ready, pending, deleted) belongs in the IaC editor.
const DEPLOY_PHASE_STATUSES = [
  'submitting', 'in_progress', 'building', 'complete',
  'failed', 'rolled_back', 'build_failed',
]

function StepFourPanel({ projectId, setStep4CanContinue, onBackToCanvas, onAdvanceToStepFive }) {
  // AWS connect + secret entry moved to Step 2 (AwsSetup); Step 4 now opens
  // straight into the IaC editor — by here the account is connected and every
  // secret is in Secrets Manager.
  const [phase, setPhase] = useState('iac')
  const [hydrating, setHydrating] = useState(true)

  // iac phase state
  const [iacTemplate, setIacTemplate] = useState('')
  const [iacValidation, setIacValidation] = useState(null)
  const [iacFindings, setIacFindings] = useState([])
  const [iacGenerating, setIacGenerating] = useState(false)
  const [iacRefining, setIacRefining] = useState(false)
  const [iacValidating, setIacValidating] = useState(false)
  const [iacError, setIacError] = useState(null)
  const [iacReady, setIacReady] = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const [refineHistory, setRefineHistory] = useState([])
  // Model choice: generate (initial template) and chat (refine turns).
  // Generate defaults to null so the user must pick before generating.
  const [generateModel, setGenerateModel] = useState(null)
  const [chatModel, setChatModel] = useState('haiku-4-5')
  const iacGenStartedRef = useRef(false)

  // provisioning phase state
  const [provisioningLog, setProvisioningLog] = useState([])
  const [deployStatus, setDeployStatus] = useState(null)
  const [deployError, setDeployError] = useState(null)
  const [deployCorrecting, setDeployCorrecting] = useState(false)
  const [stackOutputs, setStackOutputs] = useState([])
  const deployPollRef = useRef(null)
  const provisionJobIdRef = useRef(null)

  // infra lifecycle (pause / resume / delete) state
  const [infraActionLoading, setInfraActionLoading] = useState(false)
  const [infraActionError, setInfraActionError] = useState(null)
  const [teardownOpen, setTeardownOpen] = useState(false)

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
        if (data.template) {
          setIacTemplate(data.template)
          setIacValidation(data.validation || null)
          setIacFindings(data.security_findings || [])
          setIacReady(data.status === 'iac_ready')

          // A submitted/live/build-failed deployment must resume into the
          // provisioning/success screen, not fall back to the IaC editor —
          // found live: a fresh page load always showed the editor even when
          // the deployment had already reached e.g. build_failed, silently
          // discarding the "Retry build" screen the user needed to see.
          let deployData = null
          try {
            deployData = await api.getDeployStatus(projectId)
          } catch { /* no submitted deployment yet — fall through to iac */ }
          // Only a status that describes a real stack resumes into that screen.
          // Found live: after a teardown the deployment is `deleted`, which is
          // neither `iac_ready` nor `complete` — it rendered the old provisioning
          // log with no controls at all, so a torn-down project could never be
          // provisioned again from the UI.
          if (!cancelled && deployData && DEPLOY_PHASE_STATUSES.includes(deployData.status)) {
            setProvisioningLog(deployData.log || [])
            setDeployStatus(deployData.status)
            setStackOutputs(deployData.outputs || [])
            if (deployData.error) setDeployError(deployData.error)
            if (deployData.status === 'complete') {
              setPhase('success')
            } else {
              setPhase('provisioning')
              if (['submitting', 'in_progress', 'building'].includes(deployData.status)) {
                startDeployPoll()
              }
            }
          } else if (!cancelled) {
            setPhase('iac')
          }
        } else {
          // Connected but nothing authored yet — open the pre-generate screen.
          if (!cancelled) setPhase('iac')
        }
      } catch {
        // getIac 400s only if AWS isn't connected — which shouldn't happen since
        // Step 2 gates on it. Fall through to the editor; generate will surface a
        // clear connection error if the account really isn't linked.
        if (!cancelled) setPhase('iac')
      } finally {
        if (!cancelled) setHydrating(false)
      }
    }
    hydrate()
    return () => { cancelled = true }
  }, [projectId])

  const runGenerate = async () => {
    setIacGenerating(true)
    setIacError(null)
    try {
      const { job_id: jobId } = await api.generateIac(projectId, { model: generateModel })
      const data = await pollJob(projectId, jobId)
      if (!data.template) {
        setIacError('Generation returned an empty template — please try again.')
      } else {
        setIacTemplate(data.template)
        setIacValidation(data.validation || null)
        setIacFindings(data.security_findings || [])
        setIacReady(data.status === 'iac_ready')
        if (data.message) {
          setRefineHistory((prev) => [...prev, { role: 'assistant', text: data.message }])
        }
      }
    } catch (err) {
      setIacError(err.data?.error || 'Failed to generate the template.')
    } finally {
      setIacGenerating(false)
    }
  }

  // Reset the gen-started guard when leaving the iac phase so a back-and-forward
  // returns to the pre-generate screen rather than auto-firing again.
  useEffect(() => {
    if (phase !== 'iac') iacGenStartedRef.current = false
  }, [phase])

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
      const { job_id: jobId } = await api.refineIac(projectId, { instruction, history: refineHistory, template: iacTemplate, model: chatModel })
      const data = await pollJob(projectId, jobId)
      if (data.outcome === 'answer') {
        // A question — the agent answered without touching the template.
        setIacFindings(data.security_findings || [])
        setRefineHistory((prev) => [...prev, { role: 'assistant', text: data.message || '' }])
      } else {
        setIacTemplate(data.template || '')
        setIacValidation(data.validation || null)
        setIacFindings(data.security_findings || [])
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
      setIacFindings(data.security_findings || [])
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
      description='This permanently deletes all provisioned infrastructure for this project — the CloudFormation stack and every resource it created. This cannot be undone.'
      confirmText={infraActionLoading ? 'Deleting…' : 'Yes, delete infrastructure'}
      onCancel={() => setTeardownOpen(false)}
      onConfirm={confirmTeardown}
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

  // Non-IaC phases get their own padded container since the outer section has p-0.
  // The IaC editor is full-bleed and manages its own layout.
  if (phase === 'iac') {
    return (
      <IacEditor
        template={iacTemplate}
        onTemplateChange={(v) => { setIacTemplate(v); setIacReady(false); setIacFindings([]) }}
        validation={iacValidation}
        findings={iacFindings}
        generating={iacGenerating}
        refining={iacRefining}
        validating={iacValidating}
        error={iacError}
        ready={iacReady}
        onValidate={handleValidate}
        onRetryGenerate={runGenerate}
        refineInput={refineInput}
        onRefineInputChange={setRefineInput}
        onRefine={handleRefine}
        refineHistory={refineHistory}
        generateModel={generateModel}
        setGenerateModel={setGenerateModel}
        chatModel={chatModel}
        setChatModel={setChatModel}
        onBack={onBackToCanvas}
        onContinue={() => setPhase('review')}
      />
    )
  }

  if (phase === 'review') {
    return (
      <div className='flex flex-1 flex-col overflow-y-auto p-8'>
        <ReviewArchitecture
          showTemplate={showTemplate}
          cfTemplate={iacTemplate}
          onToggleTemplate={() => setShowTemplate((prev) => !prev)}
          onEditArchitecture={() => setPhase('iac')}
          onProvision={handleProvision}
        />
      </div>
    )
  }

  if (phase === 'provisioning') {
    return (
      <div className='flex flex-1 flex-col overflow-y-auto p-8'>
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
        />
        {teardownDialog}
      </div>
    )
  }

  // success phase
  return (
    <div className='flex flex-1 flex-col overflow-y-auto p-8'>
      <DeploymentSuccess
        stackOutputs={stackOutputs}
        copiedKey={copiedKey}
        onCopy={handleCopy}
        onGoToDashboard={() => {
          setStep4CanContinue(true)
          onAdvanceToStepFive()
        }}
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

export default StepFourPanel
