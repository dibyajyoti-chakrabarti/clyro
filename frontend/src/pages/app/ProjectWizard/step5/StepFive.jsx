import { useEffect, useRef, useState } from 'react'
import { api, pollJob } from '../../../../api'
import { WizardCard } from '../../../../components/wizard/WizardPanel'
import IacEditor from './IacEditor'

// Step 5: generate, refine, and validate the CloudFormation template. Fully
// offline — no AWS account is required (that's Step 2, already done by the
// time we get here). Review/secrets/provisioning is Step 6.
function StepFivePanel({ projectId, projectData, setProjectData, onBackToCanvas, onAdvanceToStepSix }) {
  // If we already generated a template earlier this session (e.g. the user
  // went to Step 6 and came back), reuse it from projectData instead of
  // re-hydrating from the backend.
  const [hydrating, setHydrating] = useState(!projectData?.iac?.template)

  const [iacTemplate, setIacTemplate] = useState(projectData?.iac?.template || '')
  const [iacValidation, setIacValidation] = useState(projectData?.iac?.validation || null)
  const [iacFindings, setIacFindings] = useState(projectData?.iac?.findings || [])
  const [iacGenerating, setIacGenerating] = useState(false)
  const [generatePhase, setGeneratePhase] = useState(null)
  const [iacRefining, setIacRefining] = useState(false)
  const [iacValidating, setIacValidating] = useState(false)
  const [iacError, setIacError] = useState(null)
  const [iacReady, setIacReady] = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const [refineHistory, setRefineHistory] = useState([])
  // Model choice applies only to Ask Clyro refine turns. Initial generation is deterministic.
  // Matches the backend's DEFAULT_REFINE; Claude is unavailable on this account.
  const [chatModel, setChatModel] = useState('glm-5')
  const iacGenStartedRef = useRef(false)

  // Hydrate the template from the backend on mount so a refresh resumes where
  // the user left off instead of regenerating (and thereby losing) an
  // already-authored template. getIac 400s until a template has been
  // generated (no Deployment row exists yet) — that's the normal first-visit
  // case, handled by falling through to the pre-generate screen.
  useEffect(() => {
    if (!projectId || projectData?.iac?.template) return
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
        }
      } catch {
        // No template generated yet — normal first-visit case.
      } finally {
        if (!cancelled) setHydrating(false)
      }
    }
    hydrate()
    return () => { cancelled = true }
  }, [projectId])

  const runGenerate = async () => {
    if (iacGenStartedRef.current) return
    iacGenStartedRef.current = true
    setIacGenerating(true)
    setGeneratePhase('thinking')
    setIacError(null)
    try {
      const { job_id: jobId } = await api.generateIac(projectId, {})
      // The editor stays hidden behind the curated stage loader for the whole
      // job — no partial template or raw model reasoning is streamed into it.
      // It only appears once generation is fully done (see the 0-error gate
      // below); backend generate() itself now guarantees 0 errors/blockers or
      // raises, but this stays as frontend defense-in-depth.
      const data = await pollJob(projectId, jobId, {
        onProgress: (p) => { if (p && p.phase) setGeneratePhase(p.phase) },
      })
      const hasBlockers = (data.security_findings || []).some((f) => f.severity === 'blocker')
      if (!data.template) {
        setIacError('Generation returned an empty template — please try again.')
      } else if ((data.validation && data.validation.errors > 0) || hasBlockers) {
        setIacError('Generation finished but the template still has unresolved errors — please retry.')
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
      iacGenStartedRef.current = false
      setIacGenerating(false)
      setGeneratePhase(null)
    }
  }

  // No more "Generate infrastructure" confirmation screen — generation starts
  // automatically as soon as hydration confirms there's no template yet.
  useEffect(() => {
    if (!hydrating && !iacTemplate && !iacGenerating && !iacError) {
      runGenerate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrating])

  const handleRefine = async () => {
    const instruction = refineInput.trim()
    if (!instruction || iacRefining) return
    setIacRefining(true)
    setGeneratePhase('refining')
    setIacError(null)
    setRefineHistory((prev) => [...prev, { role: 'user', text: instruction }])
    setRefineInput('')
    try {
      // Send the current editor content so the agent refines what the user sees
      // (manual edits included), not a stale server copy.
      const { job_id: jobId } = await api.refineIac(projectId, { instruction, history: refineHistory, template: iacTemplate, model: chatModel })
      // Refine emits edit blocks, not a clean template, so we DON'T stream content
      // into the editor — only the live phase, to replace the static spinner.
      const data = await pollJob(projectId, jobId, {
        onProgress: (p) => { if (p && p.phase) setGeneratePhase(p.phase) },
      })
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
      setGeneratePhase(null)
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

  return (
    <IacEditor
      template={iacTemplate}
      onTemplateChange={(v) => { setIacTemplate(v); setIacReady(false); setIacFindings([]) }}
      validation={iacValidation}
      findings={iacFindings}
      generating={iacGenerating}
      generatePhase={generatePhase}
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
      chatModel={chatModel}
      setChatModel={setChatModel}
      onBack={onBackToCanvas}
      onContinue={() => {
        // Hand the authored template to Step 6 (review + secrets + provision)
        // via projectData so it survives the step switch without re-fetching.
        setProjectData?.((prev) => ({
          ...prev,
          iac: { template: iacTemplate, validation: iacValidation, findings: iacFindings },
        }))
        onAdvanceToStepSix?.()
      }}
    />
  )
}

export default StepFivePanel
