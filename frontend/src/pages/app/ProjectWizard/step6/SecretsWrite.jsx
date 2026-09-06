import { useEffect, useState } from 'react'
import { api } from '../../../../api'
import EnvVarsPanel from '../shared/EnvVarsPanel'

// Step 6's pre-provision phase: write the secrets staged back in Step 1 for
// real, to AWS Secrets Manager, now that an AWS account is connected (Step 2).
// getEnvVars returns the same staged values (as secrets_manager_arn-backed
// defaults once the backend's staging work lands) so already-staged fields
// don't need retyping.
export default function SecretsWrite({ projectId, onDone }) {
  const [envVarsLoading, setEnvVarsLoading] = useState(true)
  const [userSecretVars, setUserSecretVars] = useState([])
  const [generatedVars, setGeneratedVars] = useState([])
  const [secretValues, setSecretValues] = useState({})
  const [showSecrets, setShowSecrets] = useState({})
  const [extraVars, setExtraVars] = useState([])
  const [savingEnvVars, setSavingEnvVars] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [autoWriting, setAutoWriting] = useState(false)

  const doSave = async (values, extras) => {
    setSaveError(null)
    try {
      // Only typed values are sent; already-saved/staged fields left blank
      // keep their existing Secrets Manager entry (the backend skips empty values).
      await api.saveEnvVars(projectId, { values, extra_vars: extras })
      onDone?.()
    } catch (err) {
      setSaveError(err.data?.error || 'Failed to save secrets. Please try again.')
      throw err
    }
  }

  useEffect(() => {
    if (!projectId) return
    setEnvVarsLoading(true)
    api.getEnvVars(projectId)
      .then(async (data) => {
        const userSecrets = data.user_secret || []
        setUserSecretVars(userSecrets)
        setGeneratedVars(data.generated || [])
        // Pre-fill from Step 1's staged values so the user isn't forced to
        // retype a secret they already entered before AWS was connected.
        const prefilled = {}
        for (const field of userSecrets) {
          if (field.staged_value) prefilled[field.key_name] = field.staged_value
        }
        setSecretValues((prev) => ({ ...prefilled, ...prev }))

        // Everything the user needs to supply was already staged in Step 1 —
        // don't make them look at a secrets form again (looked exactly like
        // being asked to retype from scratch, found live). Write straight
        // through to Secrets Manager and continue.
        const alreadyFilled = userSecrets.length === 0 || userSecrets.every(
          (field) => field.secrets_manager_arn || field.staged_value
        )
        if (alreadyFilled) {
          setAutoWriting(true)
          setEnvVarsLoading(false)
          try {
            await doSave(prefilled, [])
          } catch {
            setAutoWriting(false)
          }
        }
      })
      .catch(() => {})
      .finally(() => setEnvVarsLoading(false))
  }, [projectId])

  // A required secret is satisfied if the user typed a value, it was already
  // staged in Step 1, or it was already written on a previous visit (resume
  // case — the saved value never returns to the browser, so the field
  // otherwise renders empty).
  const allSecretsFilled = userSecretVars.length === 0 || userSecretVars.every(
    (field) => field.secrets_manager_arn || field.staged_value
      || (secretValues[field.key_name] || '').trim() !== ''
  )

  const handleSaveEnvVars = async () => {
    setSavingEnvVars(true)
    try {
      await doSave(secretValues, extraVars)
    } catch {
      // error already set by doSave
    } finally {
      setSavingEnvVars(false)
    }
  }

  if (autoWriting) {
    return (
      <div className='flex items-center justify-center py-12 gap-2 text-sm text-text-muted'>
        <span className='h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
        Writing secrets to AWS Secrets Manager…
      </div>
    )
  }

  return (
    <EnvVarsPanel
      envVarsLoading={envVarsLoading}
      userSecretVars={userSecretVars}
      generatedVars={generatedVars}
      secretValues={secretValues}
      showSecrets={showSecrets}
      extraVars={extraVars}
      allSecretsFilled={allSecretsFilled}
      savingEnvVars={savingEnvVars}
      saveError={saveError}
      onSecretValueChange={(keyName, value) => setSecretValues((prev) => ({ ...prev, [keyName]: value }))}
      onToggleSecretVisibility={(keyName) => setShowSecrets((prev) => ({ ...prev, [keyName]: !prev[keyName] }))}
      onAddVariable={() => setExtraVars((prev) => [...prev, { key: '', value: '' }])}
      onExtraVariableChange={(index, field, value) => {
        setExtraVars((prev) => {
          const next = [...prev]
          next[index] = { ...next[index], [field]: value }
          return next
        })
      }}
      onContinue={handleSaveEnvVars}
    />
  )
}
