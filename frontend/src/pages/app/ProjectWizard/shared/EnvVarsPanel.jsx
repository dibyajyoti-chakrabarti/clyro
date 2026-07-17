import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { WizardPanel } from '../../../../components/wizard/WizardPanel'

// Small square icon chip used in each card's section header — dark surface,
// thin gold border, icon centered.
function SectionIcon({ icon: Icon }) {
  return (
    <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-amber-400/25 bg-white/[0.03]'>
      <Icon className='h-4.5 w-4.5 text-amber-300' />
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

  const cardClasses =
    'mx-auto w-full max-w-4xl rounded-[20px] border border-white/[0.06] bg-[#15161c] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.35)]'

  return (
    <WizardPanel>
      <div className='mx-auto flex w-full max-w-4xl flex-col gap-7'>
        {/* Values required from you */}
        <div className={cardClasses}>
          <div className='flex items-center gap-3'>
            <SectionIcon icon={KeyRound} />
            <div>
              <h3 className='text-lg font-medium text-text-primary'>Values required from you</h3>
              <p className='mt-0.5 text-sm text-text-muted'>These secrets are needed to run your app. Fill in each one to continue.</p>
            </div>
          </div>

          <div className='mt-6 space-y-6'>
            {userSecretVars.length === 0 ? (
              <p className='text-sm text-text-muted italic'>No required secrets detected.</p>
            ) : userSecretVars.map((field) => (
              <div key={field.key_name}>
                <div className='mb-1.5 flex items-baseline justify-between gap-3'>
                  <p className='text-sm font-bold uppercase tracking-wide text-text-primary'>{field.key_name}</p>
                  {field.context_block ? <p className='text-right text-xs text-text-muted'>{field.context_block}</p> : null}
                </div>
                <div className='flex items-center gap-2'>
                  <input
                    type={showSecrets[field.key_name] ? 'text' : 'password'}
                    value={secretValues[field.key_name] || ''}
                    placeholder={field.secrets_manager_arn ? 'Saved — leave blank to keep' : ''}
                    onChange={(event) => onSecretValueChange(field.key_name, event.target.value)}
                    className='min-h-12 w-full rounded-xl border border-white/[0.08] bg-background px-4 py-3 text-sm text-text-primary transition-[border-color,box-shadow] duration-150 hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-amber-400/60 focus-visible:ring-1 focus-visible:ring-amber-400/25'
                  />
                  <Button
                    variant='ghost'
                    size='sm'
                    className='shrink-0'
                    onClick={() => onToggleSecretVisibility(field.key_name)}
                    aria-label={showSecrets[field.key_name] ? 'Hide value' : 'Show value'}
                  >
                    {showSecrets[field.key_name] ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <button
            type='button'
            className='mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.015] px-4 py-3.5 text-sm text-text-muted transition-colors duration-150 hover:border-white/[0.22] hover:text-text-primary disabled:pointer-events-none disabled:opacity-40'
            disabled={extraVars.length >= 3}
            onClick={onAddVariable}
          >
            <Plus className='h-3.5 w-3.5' />
            Add variable
          </button>
          {extraVars.length > 0 ? (
            <div className='mt-3 space-y-2'>
              {extraVars.map((row, index) => (
                <div key={index} className='grid grid-cols-2 gap-2'>
                  <input
                    type='text'
                    placeholder='KEY'
                    value={row.key}
                    onChange={(event) => onExtraVariableChange(index, 'key', event.target.value)}
                    className='rounded-xl border border-white/[0.08] bg-background px-4 py-3 text-sm text-text-primary hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-amber-400/60 focus-visible:ring-1 focus-visible:ring-amber-400/25'
                  />
                  <input
                    type='password'
                    placeholder='VALUE'
                    value={row.value}
                    onChange={(event) => onExtraVariableChange(index, 'value', event.target.value)}
                    className='rounded-xl border border-white/[0.08] bg-background px-4 py-3 text-sm text-text-primary hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-amber-400/60 focus-visible:ring-1 focus-visible:ring-amber-400/25'
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Auto-generated by Crylo */}
        {generatedVars.length > 0 ? (
          <div className={cardClasses}>
            <div className='flex items-center gap-3'>
              <SectionIcon icon={Sparkles} />
              <div>
                <h3 className='text-lg font-medium text-text-primary'>Auto-generated by Crylo</h3>
                <p className='mt-0.5 text-sm text-text-muted'>Crylo creates and manages these for you — no action needed.</p>
              </div>
            </div>
            <div className='mt-6 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06] bg-background'>
              {generatedVars.map((field) => (
                <div key={field.key_name} className='flex items-center justify-between gap-4 px-4 py-3'>
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

        {/* Info banner */}
        <div className='flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3.5'>
          <ShieldCheck className='mt-0.5 h-4 w-4 shrink-0 text-amber-300' />
          <p className='text-xs text-text-muted'>
            {mode === 'stage'
              ? 'Values are held for you here — they\'re written to AWS Secrets Manager in your account once you connect it in the next step. Crylo never stores them in the clear.'
              : 'Secret values are written directly to AWS Secrets Manager in your account. Crylo never stores them.'}
          </p>
        </div>

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
