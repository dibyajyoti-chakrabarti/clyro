import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Copy, FileCode2, Play, RefreshCw, Send, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import Button from '../../../../components/ui/Button'
import CfnEditor from '../../../../components/wizard/CfnEditor'

// ── Constants ──────────────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  // Claude models — fully supported (Converse API + tool use)
  { key: 'sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { key: 'haiku-4-5', label: 'Claude Haiku 4.5' },
  // Amazon Nova — requires Nova Pro/Lite enabled in Bedrock Model Access (ap-south-1)
  { key: 'nova-pro', label: 'Amazon Nova Pro' },
  { key: 'nova-lite', label: 'Amazon Nova Lite' },
]

const STAGES = [
  'Analyzing your architecture…',
  'Selecting AWS services and resource types…',
  'Writing CloudFormation resources…',
  'Configuring networking and IAM roles…',
  'Applying reliability and security best practices…',
  'Finalizing the template…',
]

const MIN_CHAT_WIDTH = 260
const MIN_EDITOR_WIDTH = 380
const DEFAULT_CHAT_RATIO = 0.30
const MOBILE_BREAKPOINT = 768

// ── ModelSelect ────────────────────────────────────────────────────────────────

function ModelSelect({ value, onChange, placeholder = 'Select model…', large = false }) {
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
      setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, minWidth: rect.width })
    }
    setOpen((v) => !v)
  }

  const triggerBase = large
    ? 'flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-sm text-text-primary hover:border-accent/40 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:border-accent/50'
    : 'flex items-center gap-1 rounded-md border border-white/[0.09] bg-surface px-2 py-1 text-xs text-text-primary hover:border-white/[0.15] focus-visible:outline-none'

  return (
    <div ref={triggerRef} className={large ? 'w-full' : 'relative'}>
      <button type='button' onClick={handleOpen} className={triggerBase}>
        <span className={`${large ? '' : 'max-w-[140px]'} truncate ${!selected ? 'text-text-muted' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div ref={dropdownRef} style={{ position: 'absolute', zIndex: 99999, ...pos }}>
          <div className='rounded-lg border border-white/[0.09] bg-[#111] py-1 shadow-xl'>
            {MODEL_OPTIONS.map((m) => (
              <button
                key={m.key}
                type='button'
                onClick={() => { onChange(m.key); setOpen(false) }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left whitespace-nowrap hover:bg-white/[0.06] ${m.key === value ? 'text-accent' : 'text-text-primary'}`}
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
  generating,
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
  generateModel,
  setGenerateModel,
  chatModel,
  setChatModel,
  onBack,
  onContinue,
}) {
  const errors = validation?.errors ?? 0
  const warnings = validation?.warnings ?? 0
  const isValid = validation?.is_valid

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
  const stageMessage = STAGES[Math.min(Math.floor(elapsed / 9), STAGES.length - 1)]

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

  // ── Mobile detection ───────────────────────────────────────────────────────

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Resizable chat sidebar ─────────────────────────────────────────────────

  const containerRef = useRef(null)
  const [chatWidth, setChatWidth] = useState(() =>
    Math.max(MIN_CHAT_WIDTH, Math.round(window.innerWidth * DEFAULT_CHAT_RATIO))
  )
  const dragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const handleDragStart = useCallback((e) => {
    dragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = chatWidth
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'
    e.preventDefault()
  }, [chatWidth])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging.current) return
      const delta = dragStartX.current - e.clientX
      const containerW = containerRef.current?.offsetWidth ?? window.innerWidth
      const maxChat = containerW - MIN_EDITOR_WIDTH
      const newWidth = Math.max(MIN_CHAT_WIDTH, Math.min(dragStartWidth.current + delta, maxChat))
      setChatWidth(newWidth)
    }
    const handleMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

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
              : 'Choose a model and generate a CloudFormation template for your architecture.'}
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      {generating && !template ? (
        /* Full-screen spinner during generation */
        <div className='flex flex-1 flex-col items-center justify-center gap-5 text-center'>
          <span className='h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin' />
          <div className='space-y-1'>
            <p className='text-sm font-medium text-text-primary'>{stageMessage}</p>
            <p className='text-xs text-text-muted'>
              {elapsed < 5 ? 'Starting up…' : `${elapsed}s elapsed`}
            </p>
          </div>
          <div className='flex gap-1.5'>
            {STAGES.map((_, i) => (
              <span
                key={i}
                className={`h-1 rounded-full transition-all duration-700 ${
                  i <= Math.min(Math.floor(elapsed / 9), STAGES.length - 1)
                    ? 'w-6 bg-accent'
                    : 'w-3 bg-white/[0.12]'
                }`}
              />
            ))}
          </div>
          {elapsed > 90 && (
            <p className='max-w-xs text-xs text-text-muted/70'>
              Taking longer than usual — the agent may be handling a complex architecture.
            </p>
          )}
        </div>

      ) : !template && error ? (
        /* Error state with retry + model picker */
        <div className='flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center'>
          <AlertTriangle className='h-6 w-6 text-red-400' />
          <p className='max-w-md text-sm text-red-300'>{error}</p>
          <div className='w-full max-w-xs space-y-3'>
            <p className='text-xs text-text-muted'>Select model and try again</p>
            <ModelSelect value={generateModel} onChange={setGenerateModel} large />
            <Button variant='primary' onClick={onRetryGenerate} disabled={!generateModel} className='w-full justify-center'>
              <RefreshCw className='h-4 w-4' />
              Retry generation
            </Button>
          </div>
        </div>

      ) : !template ? (
        /* Pre-generate: prominent model selector + generate button */
        <div className='flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center'>
          <div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10'>
            <FileCode2 className='h-8 w-8 text-accent' />
          </div>
          <div className='space-y-2'>
            <p className='text-base font-semibold text-text-primary'>Choose a model to generate</p>
            <p className='max-w-sm text-sm text-text-muted'>
              Clyro will analyze your architecture and write a CloudFormation template. Pick the model that best fits your needs.
            </p>
          </div>
          <div className='w-full max-w-xs space-y-3'>
            <ModelSelect value={generateModel} onChange={setGenerateModel} large placeholder='Select a model…' />
            <Button
              variant='primary'
              onClick={onRetryGenerate}
              disabled={!generateModel}
              className='w-full justify-center'
            >
              <Play className='h-4 w-4' />
              Generate template
            </Button>
            {!generateModel && (
              <p className='text-xs text-text-muted'>Select a model above to continue.</p>
            )}
          </div>
        </div>

      ) : (
        /* ── Editor + chat split view ── */
        <div
          ref={containerRef}
          className={`flex min-h-0 flex-1 ${isMobile ? 'flex-col' : 'flex-row'}`}
        >

          {/* Left: editor panel */}
          <div className='flex min-w-0 flex-1 flex-col'>

            {/* IaC model toolbar — switch model + regenerate */}
            <div className='flex shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-2'>
              <span className='shrink-0 text-xs text-text-muted'>IaC model</span>
              <div className='w-[200px]'>
                <ModelSelect value={generateModel} onChange={setGenerateModel} />
              </div>
              <button
                type='button'
                onClick={onRetryGenerate}
                disabled={generating || refining || !generateModel}
                title={!generateModel ? 'Select a model first' : 'Regenerate template'}
                className='flex items-center gap-1.5 rounded-md border border-white/[0.07] px-2 py-1 text-xs text-text-muted transition-colors hover:border-white/[0.15] hover:text-text-primary disabled:pointer-events-none disabled:opacity-40'
              >
                <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Regenerating…' : 'Regenerate'}
              </button>
              {/* Inline error from a failed regeneration (template is still shown) */}
              {error && !generating && (
                <span className='flex items-center gap-1 text-xs text-red-400'>
                  <AlertTriangle className='h-3 w-3' />
                  {error}
                </span>
              )}
            </div>

            {/* Monaco editor */}
            <div className='min-h-0 flex-1'>
              <CfnEditor
                value={template}
                onChange={onTemplateChange}
                markers={validation?.diagnostics || []}
                readOnly={refining || generating}
              />
            </div>

            {/* Status bar */}
            <div className='flex shrink-0 items-center justify-between border-t border-white/[0.07] px-4 py-2'>
              <div>
                {validation == null ? (
                  <span className='text-xs text-text-muted'>Not validated yet</span>
                ) : isValid ? (
                  <span className='flex items-center gap-1.5 text-xs text-success'>
                    <Check className='h-3.5 w-3.5' strokeWidth={3} />
                    Valid{warnings ? ` · ${warnings} warning${warnings > 1 ? 's' : ''}` : ''}
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
                  onClick={handleCopy}
                  title='Copy template'
                  className='flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-xs text-text-muted transition-colors hover:border-white/[0.15] hover:text-text-primary'
                >
                  {copied ? (
                    <><Check className='h-3.5 w-3.5 text-success' strokeWidth={3} /><span>Copied!</span></>
                  ) : (
                    <><Copy className='h-3.5 w-3.5' /><span>Copy</span></>
                  )}
                </button>
                <Button variant='secondary' size='sm' onClick={onValidate} disabled={validating || refining || generating || !template}>
                  {validating ? (
                    <span className='h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin' />
                  ) : 'Validate'}
                </Button>
              </div>
            </div>
          </div>

          {/* Right: chat sidebar — resizable on desktop, stacked on mobile */}
          <div
            style={isMobile ? {} : { width: chatWidth, minWidth: MIN_CHAT_WIDTH }}
            className={`flex shrink-0 flex-col ${isMobile ? 'h-[340px] border-t border-white/[0.07]' : 'relative border-l border-white/[0.07]'}`}
          >
            {/* Drag handle */}
            {!isMobile && (
              <div
                onMouseDown={handleDragStart}
                className='absolute inset-y-0 left-0 z-10 w-1 cursor-ew-resize transition-colors hover:bg-accent/40 active:bg-accent/60'
                title='Drag to resize'
              />
            )}

            {/* Chat header — title only */}
            <div className='shrink-0 border-b border-white/[0.07] px-4 py-3'>
              <p className='flex items-center gap-2 text-sm font-semibold text-text-primary'>
                <Sparkles className='h-4 w-4 text-accent' />
                Ask Clyro
              </p>
            </div>

            {/* Model selector — full-width row above messages (Claude/Cursor style) */}
            <div className='shrink-0 border-b border-white/[0.07] bg-white/[0.02] px-3 py-2.5'>
              <p className='mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted/60'>Model</p>
              <ModelSelect value={chatModel} onChange={setChatModel} large />
            </div>

            {/* Messages */}
            <div className='flex-1 overflow-y-auto px-3 py-4'>
              {refineHistory.length === 0 ? (
                <div className='space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3'>
                  <p className='text-[11px] font-medium text-text-muted/70 uppercase tracking-wider'>Try asking</p>
                  {[
                    'Make the database multi-AZ',
                    'Increase backend tasks to 2',
                    'Add a CloudWatch alarm for SQS backlog',
                  ].map((hint) => (
                    <button
                      key={hint}
                      type='button'
                      onClick={() => onRefineInputChange(hint)}
                      className='block w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-xs text-text-muted transition-colors hover:border-accent/30 hover:bg-accent/5 hover:text-text-primary'
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              ) : (
                <div className='space-y-4'>
                  {refineHistory.map((m, i) => (
                    <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.role === 'assistant' && (
                        <div className='mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20'>
                          <Sparkles className='h-2.5 w-2.5 text-accent' />
                        </div>
                      )}
                      <div className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'rounded-br-sm bg-accent/15 text-text-primary'
                          : 'rounded-bl-sm bg-white/[0.04] text-text-muted'
                      }`}>
                        {m.role === 'user' ? m.text : (
                          <div className='space-y-2 [&_p]:m-0 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-4 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_a]:underline'>
                            <ReactMarkdown>{m.text}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {refining && (
                <div className='mt-4 flex items-center gap-2 text-xs text-text-muted'>
                  <div className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20'>
                    <span className='h-2 w-2 rounded-full border border-accent border-t-transparent animate-spin' />
                  </div>
                  Updating the template…
                </div>
              )}
            </div>

            {/* Chat input */}
            <div className='shrink-0 border-t border-white/[0.07] p-3'>
              <div className='flex items-end gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 py-2 focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/20 transition-[border-color,box-shadow] duration-150'>
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
                  className='flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none disabled:opacity-50'
                  style={{ minHeight: '22px' }}
                />
                <button
                  type='button'
                  onClick={onRefine}
                  disabled={refining || !refineInput.trim()}
                  className='mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-black transition-opacity disabled:opacity-30 hover:opacity-90'
                >
                  <Send className='h-3.5 w-3.5' />
                </button>
              </div>
              <p className='mt-1.5 text-center text-[10px] text-text-muted/40'>Enter to send · Shift+Enter for new line</p>
            </div>
          </div>

        </div>
      )}

      {/* ── Footer ── */}
      <div className='flex shrink-0 items-center gap-4 border-t border-white/[0.07] px-6 py-3'>
        <button
          type='button'
          className='inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary'
          onClick={onBack}
        >
          <ArrowLeft className='h-4 w-4' />
          Back
        </button>
        <Button variant='primary' disabled={!ready} onClick={onContinue}>
          Continue
          <ArrowRight className='h-4 w-4' />
        </Button>
        {!ready && template && !generating && !error && (
          <span className='text-xs text-text-muted'>Validate the template to continue.</span>
        )}
      </div>

    </div>
  )
}
