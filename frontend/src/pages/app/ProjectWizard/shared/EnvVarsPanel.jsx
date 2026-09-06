import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { WizardPanel } from '../../../../components/wizard/WizardPanel'
import secretsIllustration from '../../../../assets/steps/step1/secrets.webp'

// Goldenrod border used only for the Step 1 / Sub-step 5 ("stage") card
// treatment — sits outside the amber-400 Tailwind scale already used
// elsewhere in this file, so it's centralized here rather than repeated
// as a literal in every className.
const GOLD_BORDER = 'border-[#c79a3a]/45'
const GOLD_BORDER_HOVER = 'hover:border-[#c79a3a]/70'
const GOLD_BORDER_FOCUS = 'focus-visible:border-[#c79a3a]/80'

// Small square icon chip used in each card's section header. `legacy` keeps
// the original uniform-amber treatment (Step 6 / write mode); the non-legacy
// path tints the chip per icon (amber for key, green for sparkle) to match
// the Step 1 / Sub-step 5 reference design.
function SectionIcon({ icon: Icon, tone = 'amber', legacy = false }) {
  if (legacy) {
    return (
      <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-amber-400/25 bg-white/[0.03]'>
        <Icon className='h-4.5 w-4.5 text-amber-300' />
      </div>
    )
  }
  const toneClasses =
    tone === 'green'
      ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
      : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border ${toneClasses}`}>
      <Icon className='h-4.5 w-4.5' />
    </div>
  )
}

function EnvVarsPanel({
  envVarsLoading,
  userSecretVars,
  generatedVars,
  secretValues,
  showSecrets,
  extraVars,
  allSecretsFilled,
  savingEnvVars,
  saveError,
  onSecretValueChange,
  onToggleSecretVisibility,
  onAddVariable,
  onExtraVariableChange,
  onContinue,
  mode = 'write',
}) {
  // Step 1 / Sub-step 5 ("Generate & validate infrastructure") stages secrets
  // with mode='stage'; Step 6's write-through re-render stays on the legacy
  // look so this restyle never leaks into other steps.
  const isStep1 = mode === 'stage'

  if (envVarsLoading) {
    return (
      <WizardPanel>
        <div className='flex items-center justify-center py-12 gap-2 text-sm text-text-muted'>
          <span className='h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
          Loading environment variables…
        </div>
      </WizardPanel>
    )
  }

  const cardClasses = isStep1
    ? `mx-auto w-full rounded-2xl border ${GOLD_BORDER} bg-background p-6 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.5)]`
    : 'mx-auto w-full max-w-4xl rounded-2xl border border-white/[0.08] bg-[#15161c] p-8 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_20px_45px_-20px_rgba(0,0,0,0.55)] transition-shadow duration-200'

  const inputClasses = isStep1
    ? `min-h-12 w-full rounded-xl border ${GOLD_BORDER} bg-background px-4 py-3 text-sm text-text-primary transition-colors duration-150 placeholder:text-text-muted/50 ${GOLD_BORDER_HOVER} focus-visible:outline-none ${GOLD_BORDER_FOCUS}`
    : 'min-h-12 w-full rounded-xl border border-white/[0.08] bg-background px-4 py-3 text-sm text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-[border-color,box-shadow] duration-150 placeholder:text-text-muted/50 hover:border-white/[0.16] focus-visible:outline-none focus-visible:border-amber-400/70 focus-visible:shadow-[0_0_0_3px_rgba(251,191,36,0.12)]'

  const dashedButtonClasses = isStep1
    ? `mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed ${GOLD_BORDER} bg-white/[0.015] px-4 py-3.5 text-sm text-text-muted transition-colors duration-150 ${GOLD_BORDER_HOVER} hover:bg-white/[0.025] hover:text-text-primary disabled:pointer-events-none disabled:opacity-40`
    : 'mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.015] px-4 py-3.5 text-sm text-text-muted transition-colors duration-150 hover:border-amber-400/30 hover:bg-white/[0.025] hover:text-text-primary disabled:pointer-events-none disabled:opacity-40'

  const generatedListClasses = isStep1
    ? `mt-7 divide-y divide-white/[0.06] overflow-hidden rounded-xl border ${GOLD_BORDER} bg-background`
    : 'mt-7 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07] bg-background shadow-[0_1px_2px_rgba(0,0,0,0.2)_inset]'

  return (
    <WizardPanel>
      <div className={isStep1 ? 'mx-auto flex w-full max-w-5xl flex-col gap-9' : 'mx-auto flex w-full max-w-4xl flex-col gap-8'}>
        {isStep1 ? (
          <div className='flex flex-col-reverse items-center gap-7 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-6'>
            <div>
              <h1 className='leading-[1.05] tracking-tight text-text-primary'>
                <span className='block text-5xl font-extrabold sm:text-6xl md:text-7xl'>Tell us your</span>
                <span className='mt-2 block text-5xl font-extrabold text-amber-400 sm:text-6xl md:text-7xl'>secrets</span>
              </h1>
              <p className='mt-6 max-w-sm text-sm leading-relaxed text-text-muted'>
                Share the sensitive details your app needs.
                <br />
                We store them securely and use them only when required.
              </p>
            </div>
            <img
              src={secretsIllustration}
              alt=''
              className='w-[260px] shrink-0 object-contain sm:mr-4 sm:w-[360px]'
            />
          </div>
        ) : (
          <div>
            <h2 className='text-2xl font-semibold tracking-tight text-text-primary'>
              Configure <span className='text-amber-300'>Environment Variables</span>
            </h2>
            <p className='mt-1.5 text-sm text-text-muted'>
              Provide the secrets your app needs to run. Clyro handles the rest automatically.
            </p>
          </div>
        )}

        {/* Values required from you */}
        <div className={cardClasses}>
          <div className='flex items-center gap-3'>
            <SectionIcon icon={KeyRound} tone='amber' legacy={!isStep1} />
            <div>
              <h3 className='text-lg font-medium text-text-primary'>Values required from you</h3>
              <p className='mt-0.5 text-sm text-text-muted'>
                These secrets are needed to run your app. Anything Clyro can generate itself is
                marked — fill in the rest to continue.
              </p>
            </div>
          </div>

          <div className='mt-7 space-y-6'>
            {userSecretVars.length === 0 ? (
              <p className='text-sm text-text-muted italic'>No required secrets detected.</p>
            ) : userSecretVars.map((field) => (
              <div key={field.key_name}>
                <div className='mb-1.5 flex items-baseline justify-between gap-3'>
                  <p className='text-sm font-bold uppercase tracking-wide text-text-primary'>{field.key_name}</p>
                  {field.context_block ? (
                    <p className={`text-right text-xs text-text-muted ${isStep1 ? 'font-mono' : ''}`}>{field.context_block}</p>
                  ) : null}
                </div>
                {/* CLYRO.md's `third_party` hint: this value only exists in an
                    external console, so link straight to it rather than leaving
                    the user to hunt for which dashboard mints it. */}
                {field.acquire_url ? (
                  <p className='mb-1.5 text-xs text-text-muted'>
                    Get it at{' '}
                    <a
                      href={field.acquire_url}
                      target='_blank'
                      rel='noreferrer'
                      className='text-amber-300/90 underline decoration-amber-300/30 underline-offset-2 hover:text-amber-200'
                    >
                      {field.acquire_url.replace(/^https?:\/\//, '')}
                    </a>
                  </p>
                ) : null}
                <div className='flex items-center gap-2'>
                  <input
                    type={showSecrets[field.key_name] ? 'text' : 'password'}
                    value={secretValues[field.key_name] || ''}
                    placeholder={
                      field.secrets_manager_arn
                        ? 'Saved — leave blank to keep'
                        : field.hint === 'agent_generatable'
                          ? 'Leave blank — Clyro generates this for you'
                          : ''
                    }
                    onChange={(event) => onSecretValueChange(field.key_name, event.target.value)}
                    className={inputClasses}
                  />
                  {isStep1 ? (
                    <button
                      type='button'
                      onClick={() => onToggleSecretVisibility(field.key_name)}
                      aria-label={showSecrets[field.key_name] ? 'Hide value' : 'Show value'}
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${GOLD_BORDER} bg-background text-text-muted transition-colors duration-150 ${GOLD_BORDER_HOVER} hover:text-text-primary focus-visible:outline-none ${GOLD_BORDER_FOCUS}`}
                    >
                      {showSecrets[field.key_name] ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                    </button>
                  ) : (
                    <Button
                      variant='ghost'
                      size='sm'
                      className='shrink-0'
                      onClick={() => onToggleSecretVisibility(field.key_name)}
                      aria-label={showSecrets[field.key_name] ? 'Hide value' : 'Show value'}
                    >
                      {showSecrets[field.key_name] ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type='button'
            className={dashedButtonClasses}
            disabled={extraVars.length >= 3}
            onClick={onAddVariable}
          >
            <Plus className='h-3.5 w-3.5' />
            Add variable
          </button>
          {extraVars.length > 0 ? (
            <div className='mt-4 space-y-2.5'>
              {extraVars.map((row, index) => (
                <div key={index} className='grid grid-cols-2 gap-2.5'>
                  <input
                    type='text'
                    placeholder='KEY'
                    value={row.key}
                    onChange={(event) => onExtraVariableChange(index, 'key', event.target.value)}
                    className={inputClasses}
                  />
                  <input
                    type='password'
                    placeholder='VALUE'
                    value={row.value}
                    onChange={(event) => onExtraVariableChange(index, 'value', event.target.value)}
                    className={inputClasses}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Auto-generated by Clyro */}
        {generatedVars.length > 0 ? (
          <div className={cardClasses}>
            <div className='flex items-center gap-3'>
              <SectionIcon icon={Sparkles} tone='green' legacy={!isStep1} />
              <div>
                <h3 className='text-lg font-medium text-text-primary'>Auto-generated by Clyro</h3>
                <p className='mt-0.5 text-sm text-text-muted'>Clyro creates and manages these for you. No action needed.</p>
              </div>
            </div>
            <div className={generatedListClasses}>
              {generatedVars.map((field) => (
                <div
                  key={field.key_name}
                  className='flex items-center justify-between gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-white/[0.02]'
                >
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-medium text-text-primary'>{field.key_name}</p>
                    {field.production_default ? <p className='truncate text-xs text-text-muted'>{field.production_default}</p> : null}
                  </div>
                  <div className='flex shrink-0 items-center gap-2.5'>
                    <Lock className='h-3.5 w-3.5 text-amber-400/50' />
                    <span className='rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-300'>Auto-generated</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isStep1 ? (
          <div className={`flex items-start gap-2.5 rounded-xl border ${GOLD_BORDER} bg-amber-400/[0.04] px-4 py-3.5`}>
            <ShieldCheck className='mt-0.5 h-4 w-4 shrink-0 text-amber-300' />
            <p className='text-xs text-text-muted'>
              These values are securely stored in AWS Secrets Manager and are never exposed in your application code or logs.
            </p>
          </div>
        ) : null}

        {/* Info banner — Step 1 (stage) drops this; the "securely stored" banner
            above already covers it, per this step's restyle. Step 6 (write) keeps it. */}
        {!isStep1 ? (
          <div className='flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3.5'>
            <ShieldCheck className='mt-0.5 h-4 w-4 shrink-0 text-amber-300' />
            <p className='text-xs text-text-muted'>
              Secret values are written directly to AWS Secrets Manager in your account. Clyro never stores them.
            </p>
          </div>
        ) : null}

        {saveError ? (
          <p className='-mt-3 text-xs text-red-400'>{saveError}</p>
        ) : null}

        <div className='flex justify-end pb-2'>
          <Button variant='primary' disabled={!allSecretsFilled || savingEnvVars} onClick={onContinue}>
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
        </div>
      </div>
    </WizardPanel>
  )
}

export default EnvVarsPanel
