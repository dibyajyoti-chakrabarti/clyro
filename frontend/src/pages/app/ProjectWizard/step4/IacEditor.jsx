import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileCode2, Send, Wand2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import Button from '../../../../components/ui/Button'
import CfnEditor from '../../../../components/wizard/CfnEditor'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

// Model choices per slot, mapped to the agent's registry. The dropdowns let the
// user pick which model authors the template (Generate), runs lightweight refines
// (Chat), and handles big/structural edits (Stronger).
const MODEL_OPTIONS = [
  { key: 'sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { key: 'haiku-4-5', label: 'Claude Haiku 4.5' },
  { key: 'nova-pro', label: 'Amazon Nova Pro' },
  { key: 'nova-lite', label: 'Amazon Nova Lite' },
  { key: 'qwen-coder', label: 'Qwen3-Coder 30B' },
]

const inputClass =
  'w-full rounded-lg border border-white/[0.09] bg-surface px-3 py-2 text-sm text-text-primary transition-[border-color,box-shadow] duration-150 hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20 disabled:opacity-50'

function IacEditor({
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
  forceStrong,
  onForceStrongChange,
  generateModel,
  setGenerateModel,
  chatModel,
  setChatModel,
  strongModel,
  setStrongModel,
  onBack,
  onContinue,
}) {
  const errors = validation?.errors ?? 0
  const warnings = validation?.warnings ?? 0
  const isValid = validation?.is_valid

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
          <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted'>
            <span className='font-medium text-text-primary'>Models</span>
            {[
              ['Generate', generateModel, setGenerateModel],
              ['Chat', chatModel, setChatModel],
              ['Stronger', strongModel, setStrongModel],
            ].map(([label, value, setter]) => (
              <label key={label} className='flex items-center gap-1.5'>
                {label}
                <select
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className='rounded-md border border-white/[0.09] bg-surface px-2 py-1 text-xs text-text-primary focus-visible:outline-none focus-visible:border-accent/50'
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        {generating && !template ? (
          <div className='flex items-center justify-center gap-2 py-24 text-sm text-text-muted'>
            <span className='h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
            Generating your CloudFormation template…
          </div>
        ) : (!template && error) ? (
          <div className='flex flex-col items-center justify-center gap-3 py-20 text-center'>
            <AlertTriangle className='h-6 w-6 text-red-400' />
            <p className='max-w-md text-sm text-red-300'>{error}</p>
            <Button variant='secondary' onClick={onRetryGenerate}>
              Retry generation
            </Button>
          </div>
        ) : (
          <div className='mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]'>
            <div className='flex flex-col'>
              <div className='h-[680px] overflow-hidden rounded-lg border border-white/[0.09]'>
                <CfnEditor
                  value={template}
                  onChange={onTemplateChange}
                  markers={validation?.diagnostics || []}
                  readOnly={refining}
                />
              </div>
              <div className='mt-3 flex items-center justify-between gap-3'>
                <div className='flex items-center gap-3 text-sm'>
                  {validation == null ? (
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
                <Button variant='secondary' size='sm' onClick={onValidate} disabled={validating || refining || !template}>
                  {validating ? (
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
                {refining ? (
                  <div className='flex items-center gap-2 text-xs text-text-muted'>
                    <span className='h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin' />
                    Updating the template…
                  </div>
                ) : null}
              </div>
              <div className='border-t border-white/[0.07] p-2'>
                <label className='mb-2 flex items-center gap-2 text-[11px] text-text-muted'>
                  <input
                    type='checkbox'
                    checked={forceStrong}
                    onChange={(e) => onForceStrongChange(e.target.checked)}
                    disabled={refining}
                    className='h-3 w-3 accent-accent'
                  />
                  Use the stronger model (for big / structural changes)
                </label>
                <div className='flex gap-2'>
                  <input
                    type='text'
                    value={refineInput}
                    onChange={(e) => onRefineInputChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onRefine() }}
                    placeholder='Describe a change…'
                    disabled={refining}
                    className={inputClass}
                  />
                  <Button variant='secondary' size='sm' onClick={onRefine} disabled={refining || !refineInput.trim()}>
                    <Send className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error ? <p className='mt-3 text-xs text-red-400'>{error}</p> : null}

        <div className='mt-5 flex items-center gap-4'>
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
          {!ready ? <span className='text-xs text-text-muted'>Validate the template to continue.</span> : null}
        </div>
      </WizardCard>
    </WizardPanel>
  )
}

export default IacEditor
