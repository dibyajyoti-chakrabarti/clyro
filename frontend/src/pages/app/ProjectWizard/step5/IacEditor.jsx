import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, ArrowUp, Bell, Check, CheckCheck, CheckCircle2, ChevronDown, Copy, Database, FileCode2, Quote, RefreshCw, RotateCcw, Settings, Sparkles, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import Button from '../../../../components/ui/Button'
// Monaco, monaco-yaml and their language workers are about four fifths of the
// whole bundle, and Step 5 is the only screen that renders an editor. Loading it
// lazily keeps all of that out of the entry chunk, so the landing page and the
// first four wizard steps no longer pay for it.
const CfnEditor = lazy(() => import('../../../../components/wizard/CfnEditor'))

// ── Constants ──────────────────────────────────────────────────────────────────

// Agentic open models — tool-tuned, run the toolful self-correcting path.
//
// Claude Sonnet 4.5 and Haiku 4.5 were listed here and are still supported by
// the backend, but every Anthropic id on this AWS account currently returns
// AccessDeniedException / INVALID_PAYMENT_INSTRUMENT. Offering a choice that
// always fails is worse than not offering it, so they are withheld from the
// picker rather than deleted. Restore the two entries once the account's
// payment instrument is valid; the backend keys never went away.
const MODEL_OPTIONS = [
  { key: 'minimax-m2-5', label: 'MiniMax M2.5' },
  { key: 'glm-5', label: 'GLM 5' },
  { key: 'kimi-k2-5', label: 'Kimi K2.5' },
  { key: 'deepseek-v3-2', label: 'DeepSeek V3.2' },
]

const STAGES = [
  'Analyzing your architecture…',
  'Selecting AWS services and resource types…',
  'Writing CloudFormation resources…',
  'Configuring networking and IAM roles…',
  'Applying reliability and security best practices…',
  'Finalizing the template…',
]

// Seconds at which each STAGE begins. Calibrated to measured generate timing — a
// typical run is ~3-4 min split roughly 19% initial draft / 52% validate-and-fix
// loop / 26% final template stream. A flat elapsed/9 raced to the last stage in 45s
// and then sat on "Finalizing…" for three minutes; these thresholds keep the label on
// the (genuinely longest) best-practices/self-correction stage through the middle and
// only reach "Finalizing" near the real end.
const STAGE_STARTS = [0, 8, 20, 45, 90, 170]

function stageIndex(elapsed) {
  let idx = 0
  for (let i = 0; i < STAGE_STARTS.length; i += 1) {
    if (elapsed >= STAGE_STARTS[i]) idx = i
  }
  return idx
}

// ── ModelSelect ────────────────────────────────────────────────────────────────

function ModelSelect({ value, onChange, placeholder = 'Select model…', large = false, variant = 'default' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({})
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)
  const selected = MODEL_OPTIONS.find((m) => m.key === value)

  useEffect(() => {
    if (!open) return
    // Track both the trigger and the portal container so clicking inside
    // either one doesn't fire the outside-click close handler.
    const handler = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (dropdownRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      // Anchored to open upward: `top` marks the trigger's top edge (minus the
      // gap), and the portal below applies translateY(-100%) so the menu's
      // bottom sits there and it grows upward — avoids getting cut off when
      // the trigger sits low in the "Ask Clyro" drawer.
      setPos({ top: rect.top + window.scrollY - 4, left: rect.left + window.scrollX, minWidth: rect.width })
    }
    setOpen((v) => !v)
  }

  const triggerBase = variant === 'pill'
    ? 'flex h-10 items-center justify-between gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 text-[13px] text-text-primary hover:border-white/[0.20] hover:bg-white/[0.07] focus-visible:outline-none transition-colors duration-150'
    : large
      ? 'flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-sm text-text-primary hover:border-accent/40 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:border-accent/50'
      : 'flex items-center gap-1 rounded-md border border-white/[0.09] bg-surface px-2 py-1 text-xs text-text-primary hover:border-white/[0.15] focus-visible:outline-none'

  return (
    <div ref={triggerRef} className={large && variant !== 'pill' ? 'w-full' : 'relative shrink-0'}>
      <button type='button' onClick={handleOpen} className={triggerBase}>
        <span className={`${large || variant === 'pill' ? '' : 'max-w-[140px]'} truncate ${!selected ? 'text-text-muted' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div ref={dropdownRef} style={{ position: 'absolute', zIndex: 99999, transform: 'translateY(-100%)', ...pos }}>
          <div className='model-dropdown-scroll max-h-[280px] overflow-y-auto overscroll-contain rounded-xl border border-white/[0.09] bg-[#111] p-1 shadow-xl [scroll-behavior:smooth]'>
            {MODEL_OPTIONS.map((m) => (
              <button
                key={m.key}
                type='button'
                onClick={() => { onChange(m.key); setOpen(false) }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left whitespace-nowrap transition-colors duration-150 hover:bg-amber-400/10 ${m.key === value ? 'text-amber-400' : 'text-text-primary'}`}
              >
                {m.key === value ? <Check className='h-3.5 w-3.5 shrink-0' /> : <span className='h-3.5 w-3.5 shrink-0' />}
                {m.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── IacEditor ─────────────────────────────────────────────────────────────────

export default function IacEditor({
  template,
  onTemplateChange,
  validation,
  findings,
  generating,
  generatePhase,
  refining,
  validating,
  error,
  ready,
  onValidate,
  onRetryGenerate,
  refineInput,
  onRefineInputChange,
  onRefine,
  refineHistory,
  chatModel,
  setChatModel,
  onBack,
  onContinue,
}) {
  const errors = validation?.errors ?? 0
  const warnings = validation?.warnings ?? 0
  const isValid = validation?.is_valid
  const blockers = (findings || []).filter((f) => f.severity === 'blocker')
  const otherFindings = (findings || []).filter((f) => f.severity !== 'blocker')

  // ── Generation progress ────────────────────────────────────────────────────

  const [elapsed, setElapsed] = useState(0)
  const elapsedTimerRef = useRef(null)
  useEffect(() => {
    if (generating && !template) {
      setElapsed(0)
      elapsedTimerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } else {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
    return () => clearInterval(elapsedTimerRef.current)
  }, [generating, template])
  const currentStage = stageIndex(elapsed)
  const stageMessage = STAGES[currentStage]

  // ── Copy button ────────────────────────────────────────────────────────────

  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    if (!template) return
    try {
      await navigator.clipboard.writeText(template)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable */ }
  }, [template])

  // ── Chat drawer (Step 4 Canvas Agent open/close pattern) ───────────────────

  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setChatOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Auto-scroll to newest message ──────────────────────────────────────────

  const messagesEndRef = useRef(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [refineHistory, refining])

  // ── Validation success banner ───────────────────────────────────────────────
  // Purely presentational: watches the existing validation result for the
  // moment a Validate click resolves clean, and shows a transient strip.
  // Does not affect validation logic, state, or the Continue gate.

  const [bannerVisible, setBannerVisible] = useState(false)
  const [bannerShown, setBannerShown] = useState(false)
  const wasValidatingRef = useRef(false)

  useEffect(() => {
    const justFinished = wasValidatingRef.current && !validating
    wasValidatingRef.current = validating
    if (justFinished && isValid && blockers.length === 0) {
      setBannerVisible(true)
    }
  }, [validating, isValid, blockers.length])

  useEffect(() => {
    if (!bannerVisible) return undefined
    const raf = requestAnimationFrame(() => setBannerShown(true))
    const hideTimer = setTimeout(() => setBannerShown(false), 4500)
    const unmountTimer = setTimeout(() => setBannerVisible(false), 4900)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(hideTimer)
      clearTimeout(unmountTimer)
    }
  }, [bannerVisible])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className='flex h-full flex-col'>

      {/* ── Top bar: title only ── */}
      <div className='flex shrink-0 items-center gap-3 border-b border-white/[0.07] px-6 py-3'>
        <FileCode2 className='h-4 w-4 shrink-0 text-accent' />
        <div className='min-w-0'>
          <h3 className='text-sm font-semibold text-text-primary'>Review your infrastructure</h3>
          <p className='text-xs text-text-muted'>
            {template
              ? 'Edit the template directly or ask Clyro for changes, then validate before provisioning.'
              : 'Generate a CloudFormation template for your architecture.'}
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      {!template && error ? (
        /* Error state with retry */
        <div className='flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center'>
          <AlertTriangle className='h-6 w-6 text-red-400' />
          <p className='max-w-md text-sm text-red-300'>{error}</p>
          <div className='w-full max-w-xs'>
            <Button variant='primary' onClick={onRetryGenerate} className='w-full justify-center'>
              <RefreshCw className='h-4 w-4' />
              Retry generation
            </Button>
          </div>
        </div>

      ) : !template ? (
        /* Curated stage loader — the only generation-in-progress UI. No raw model
           reasoning/chain-of-thought is ever surfaced here (or in the editor, which
           stays hidden behind this loader for the whole job): the backend keeps
           streamed 'thinking' text for its own debugging only. Generation is kicked
           off automatically as soon as Step 5 mounts, so this is what greets the
           user immediately — there's no separate "Generate template" confirmation
           screen. */
        <div className='flex flex-1 flex-col items-center justify-center gap-5 text-center'>
          <span className='h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin' />
          <div className='space-y-1'>
            <p className='text-sm font-medium text-text-primary'>{stageMessage}</p>
            <p className='text-xs text-text-muted'>
              {elapsed < 5 ? 'Starting up…' : `${elapsed}s elapsed · usually ~3 to 4 min`}
            </p>
          </div>
          <div className='flex gap-1.5'>
            {STAGES.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-700 ${
                  i <= currentStage
                    ? 'w-6 bg-accent'
                    : 'w-3 bg-white/[0.12]'
                }`}
              />
            ))}
          </div>
          {elapsed > 240 && (
            <p className='max-w-xs text-xs text-text-muted/70'>
              Taking longer than usual. The agent may be handling a complex architecture.
            </p>
          )}
        </div>

      ) : (
        /* ── Editor with floating Canvas Agent chat (Step 4 open/close pattern) ── */
        <div className='relative flex min-h-0 flex-1 flex-col'>

            {/* IaC toolbar */}
            <div className='flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <button
                  type='button'
                  onClick={onRetryGenerate}
                  disabled={generating || refining}
                  title='Regenerate template'
                  className='inline-flex h-10 min-w-[40px] items-center justify-center gap-2 rounded-[10px] border border-[#3a3a3a] bg-[#1e1e1e] px-3 text-sm font-medium text-white transition-all duration-[180ms] ease-in-out hover:border-[#4a4a4a] hover:bg-[#242424] hover:brightness-110 active:bg-[#161616] disabled:pointer-events-none disabled:opacity-40'
                >
                  <RotateCcw className={`h-[18px] w-[18px] ${generating ? 'animate-spin' : ''}`} />
                  {generating ? 'Regenerating…' : 'Regenerate'}
                </button>
                {/* Live phase while the agent authors the template (B2 L2). */}
                {generating && generatePhase && (
                  <span className='flex items-center gap-1.5 text-xs capitalize text-accent'>
                    <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-accent' />
                    {generatePhase}…
                  </span>
                )}
                {/* Inline error from a failed regeneration (template is still shown) */}
                {error && !generating && (
                  <span className='flex items-center gap-1 text-xs text-red-400'>
                    <AlertTriangle className='h-3 w-3' />
                    {error}
                  </span>
                )}
              </div>
              <button
                type='button'
                onClick={handleCopy}
                title='Copy template'
                className='inline-flex h-10 min-w-[40px] shrink-0 items-center justify-center gap-2 rounded-[10px] border border-[#3a3a3a] bg-[#1e1e1e] px-3 text-sm font-medium text-white transition-all duration-[180ms] ease-in-out hover:border-[#4a4a4a] hover:bg-[#242424] hover:brightness-110 active:bg-[#161616]'
              >
                {copied ? (
                  <Check className='h-[18px] w-[18px] text-success' />
                ) : (
                  <Copy className='h-[18px] w-[18px]' />
                )}
              </button>
            </div>

            {/* Monaco editor */}
            <div className='relative min-h-0 flex-1 overflow-hidden'>
              {/* Validation success ribbon — transient, presentational only.
                  Same attached-to-top-edge pattern/colors as Step 4's
                  "Architecture finalized" ribbon (StepFour.jsx): absolute,
                  inset-x-0 top-0, flush with no gap, clipped to the editor
                  container's own corners via the overflow-hidden above. */}
              {bannerVisible && (
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 z-20 border-b border-[#1F7A4D] bg-[#0F2E22] px-4 py-3 transition-all duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] ${
                    bannerShown ? 'translate-y-0 opacity-100' : '-translate-y-2.5 opacity-0'
                  }`}
                >
                  <div className='flex items-center gap-2.5'>
                    <CheckCircle2 className='h-4 w-4 shrink-0 text-[#86EFAC]' />
                    <span className='text-sm font-medium text-[#86EFAC]'>Template validated successfully. Infrastructure is ready for provisioning.</span>
                  </div>
                </div>
              )}

              <Suspense
                fallback={
                  <div className='flex h-full items-center justify-center text-sm text-text-muted'>
                    Loading the editor...
                  </div>
                }
              >
                <CfnEditor
                  value={template}
                  onChange={onTemplateChange}
                  markers={validation?.diagnostics || []}
                  readOnly={refining || generating}
                />
              </Suspense>

              {/* Floating assistant button — same button chrome/animation as the Step 4 Canvas Agent trigger,
                  anchored to this editor pane (not the viewport or the status bar below it) */}
              <div className='pointer-events-none absolute bottom-6 right-6 z-30 flex flex-col items-end'>
                <div className='pointer-events-auto overflow-hidden rounded-[22px] border border-border bg-surface/90 shadow-[0_20px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-accent hover:shadow-[0_24px_48px_rgba(0,0,0,0.32)]'>
                  <button
                    type='button'
                    className='grid h-12 w-12 place-items-center text-xl text-text-primary transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:bg-white/[0.04] hover:text-accent'
                    onClick={() => setChatOpen((v) => !v)}
                    aria-label='Open chat assistant'
                  >
                    ✨
                  </button>
                </div>
              </div>
            </div>

            {/* Status bar */}
            <div className='flex shrink-0 items-center justify-between border-t border-white/[0.07] px-4 py-2'>
              <div>
                {validation == null ? (
                  <span className='text-xs text-text-muted'>Not validated yet</span>
                ) : isValid && blockers.length === 0 ? (
                  <span className='flex items-center gap-1.5 text-xs text-success'>
                    <Check className='h-3.5 w-3.5' strokeWidth={3} />
                    Valid{warnings ? ` · ${warnings} warning${warnings > 1 ? 's' : ''}` : ''}
                  </span>
                ) : isValid && blockers.length > 0 ? (
                  <span className='flex items-center gap-1.5 text-xs text-red-400'>
                    <AlertTriangle className='h-3.5 w-3.5' />
                    {blockers.length} security blocker{blockers.length > 1 ? 's' : ''} found
                  </span>
                ) : (
                  <span className='flex items-center gap-1.5 text-xs text-red-400'>
                    <AlertTriangle className='h-3.5 w-3.5' />
                    {errors} error{errors > 1 ? 's' : ''}{warnings ? ` · ${warnings} warning${warnings > 1 ? 's' : ''}` : ''}
                  </span>
                )}
              </div>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={onValidate}
                  disabled={validating || refining || generating || !template}
                  className='inline-flex h-10 min-w-[40px] items-center justify-center gap-2 rounded-[10px] border border-[#3a3a3a] bg-[#1e1e1e] px-3 text-sm font-medium text-white transition-all duration-[180ms] ease-in-out hover:border-[#4a4a4a] hover:bg-[#242424] hover:brightness-110 active:bg-[#161616] disabled:pointer-events-none disabled:opacity-40'
                >
                  {validating ? (
                    <span className='h-[18px] w-[18px] rounded-full border-2 border-current border-t-transparent animate-spin' />
                  ) : (
                    <><CheckCheck className='h-[18px] w-[18px]' />Validate</>
                  )}
                </button>
              </div>
            </div>

          {/* Backdrop — same blur/opacity/z-index as the Step 4 drawer backdrop */}
          {chatOpen ? (
            <button
              type='button'
              aria-label='Close chat backdrop'
              className='absolute inset-0 z-30 cursor-default bg-black/35 backdrop-blur-[4px]'
              onClick={() => setChatOpen(false)}
            />
          ) : null}

          {/* Docked chat drawer — same slide/fade animation, positioning, and sizing as Step 4 */}
          <div
            className={`absolute inset-y-0 right-0 z-40 h-full min-h-0 w-full max-w-[420px] p-4 ${
              chatOpen
                ? 'translate-x-0 opacity-100 transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)]'
                : 'pointer-events-none translate-x-6 opacity-0 transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)]'
            }`}
            aria-hidden={!chatOpen}
          >
            <div className='flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border border-amber-400/[0.14] bg-[#0a0a0a] shadow-[0_24px_80px_rgba(0,0,0,0.35),0_0_50px_rgba(251,191,36,0.05)]'>

              {/* Chat header */}
              <div className='flex shrink-0 items-center justify-between gap-2.5 px-4 py-3'>
                <div className='flex min-w-0 items-center gap-2.5'>
                  <span className='grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full border border-amber-400/30 bg-[#111] text-amber-400'>
                    <Sparkles className='h-[23px] w-[23px]' />
                  </span>
                  <h2 className='truncate text-xl font-bold leading-none tracking-tight text-white'>Ask Clyro</h2>
                </div>
                <button
                  type='button'
                  onClick={() => setChatOpen(false)}
                  title='Close chat'
                  aria-label='Close chat'
                  className='grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.02] text-text-muted transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-[rgba(255,193,7,0.18)] hover:bg-[rgba(255,255,255,0.04)] hover:text-text-primary'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>
              <div className='h-px w-full shrink-0 bg-white/[0.08]' />

              {/* Messages */}
              <div className='flex-1 overflow-y-auto scroll-smooth px-4 py-4'>
                {refineHistory.length === 0 ? (
                  <div className='space-y-1.5'>
                    <p className='px-1 pb-1 text-[11px] font-medium uppercase tracking-[0.15em] text-text-muted/60'>Try asking</p>
                    {[
                      { text: 'Make the database multi-AZ', icon: Database },
                      { text: 'Increase backend tasks to 2', icon: Settings },
                      { text: 'Add a CloudWatch alarm for SQS backlog', icon: Bell },
                    ].map(({ text, icon: Icon }) => (
                      <button
                        key={text}
                        type='button'
                        onClick={() => onRefineInputChange(text)}
                        className='flex h-12 w-full items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-4 text-left text-[15px] font-medium text-white transition-colors duration-200 hover:border-white/[0.20] hover:bg-white/[0.06]'
                      >
                        <Icon className='h-[18px] w-[18px] shrink-0 text-amber-400' />
                        <span className='truncate'>{text}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className='space-y-5'>
                    {refineHistory.map((m, i) => (
                      <div key={i} className={`chat-message-in flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {m.role === 'user' ? (
                          <div className='max-w-[70%] rounded-2xl border border-amber-400/25 bg-white/[0.07] px-4 py-3 text-[15px] leading-relaxed text-white shadow-[0_4px_16px_rgba(0,0,0,0.18)] transition-shadow duration-200'>
                            {m.text}
                          </div>
                        ) : (
                          <div className='relative max-w-[80%] rounded-[22px] border border-white/[0.08] bg-white/[0.035] px-5 py-4 pl-8 text-[15px] leading-[1.7] text-text-muted shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-shadow duration-200'>
                            <Quote className='absolute left-3 top-3.5 h-4 w-4 text-amber-400/30' aria-hidden='true' />
                            <div className='space-y-3 [&_p]:m-0 [&_h1]:mb-2 [&_h1]:mt-0 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-text-primary [&_h2]:mb-2 [&_h2]:mt-0 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-text-primary [&_h3]:font-semibold [&_h3]:text-text-primary [&_strong]:font-semibold [&_strong]:text-text-primary [&_em]:italic [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-400/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-amber-400 [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-amber-200 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/[0.06] [&_pre]:bg-black/40 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-white/10 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1'>
                              <ReactMarkdown>{m.text}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {refining && (
                  <div className='mt-4 flex items-center gap-2 text-xs text-text-muted'>
                    <div className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/20'>
                      <span className='h-2 w-2 rounded-full border border-amber-400 border-t-transparent animate-spin' />
                    </div>
                    {/* Live phase from the stream (B2) — falls back to a static label. */}
                    <span className='capitalize'>{generatePhase ? `${generatePhase}…` : 'Updating the template…'}</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat input */}
              <div className='shrink-0 px-4 pb-4 pt-1.5'>
                <div className='rounded-[18px] border border-amber-400/20 bg-[#111] p-3 transition-all duration-200 ease-out focus-within:border-amber-400/40'>
                  <textarea
                    rows={1}
                    value={refineInput}
                    onChange={(e) => {
                      onRefineInputChange(e.target.value)
                      // auto-resize
                      e.target.style.height = 'auto'
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onRefine() }
                    }}
                    placeholder='Describe a change…'
                    disabled={refining}
                    className='w-full resize-none bg-transparent text-[16px] font-medium text-white placeholder:font-medium placeholder:text-text-muted focus-visible:outline-none disabled:opacity-50'
                    style={{ minHeight: '22px' }}
                  />
                  <div className='mt-2 flex items-center justify-between gap-2'>
                    <ModelSelect value={chatModel} onChange={setChatModel} variant='pill' />
                    <button
                      type='button'
                      onClick={onRefine}
                      disabled={refining || !refineInput.trim()}
                      className='grid h-11 w-11 shrink-0 place-items-center rounded-full border border-amber-300/70 bg-gradient-to-b from-amber-400 to-amber-500 text-black transition-all duration-200 ease-out hover:from-amber-300 hover:to-amber-400 disabled:opacity-50'
                      aria-label='Send message'
                    >
                      <ArrowUp className='h-[18px] w-[18px]' />
                    </button>
                  </div>
                </div>
                <p className='mt-1.5 text-center text-[11px] text-text-muted/60'>Enter to send · Shift+Enter for new line</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Security findings ── */}
      {template && (blockers.length > 0 || otherFindings.length > 0) && (
        <div className='shrink-0 space-y-1.5 border-t border-white/[0.07] px-6 py-3'>
          {blockers.map((f, i) => (
            <div key={`blocker-${i}`} className='flex items-start gap-2 text-xs text-red-300'>
              <AlertTriangle className='mt-0.5 h-3.5 w-3.5 shrink-0' />
              <span>{f.message}</span>
            </div>
          ))}
          {otherFindings.map((f, i) => (
            <div key={`finding-${i}`} className='flex items-start gap-2 text-xs text-text-muted'>
              <AlertTriangle className='mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500/70' />
              <span>{f.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className='flex shrink-0 items-center justify-between gap-4 border-t border-white/[0.07] px-6 py-3'>
        <Button variant='secondary' onClick={onBack}>
          <ArrowLeft className='h-4 w-4' />
          Back
        </Button>
        <div className='flex items-center gap-4'>
          {!ready && template && !generating && !error && (
            <span className='text-xs text-text-muted'>
              {blockers.length > 0
                ? 'Resolve the security blocker(s) above to continue.'
                : 'Validate the template to continue.'}
            </span>
          )}
          <Button variant='primary' disabled={!ready} onClick={onContinue}>
            Continue
            <ArrowRight className='h-4 w-4' />
          </Button>
        </div>
      </div>

    </div>
  )
}
