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

  useEffect(() => {
    if (!projectId) return
    setEnvVarsLoading(true)
    api.getEnvVars(projectId)
      .then((data) => {
        const userSecrets = data.user_secret || []
        setUserSecretVars(userSecrets)
        setGeneratedVars(data.generated || [])
        // Pre-fill from Step 1's staged values so the user isn't forced to
        // retype a secret they already entered before AWS was connected.
        setSecretValues((prev) => {
          const next = { ...prev }
          for (const field of userSecrets) {
            if (field.staged_value && !(field.key_name in next)) {
              next[field.key_name] = field.staged_value
            }
          }
          return next
        })
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
    setSaveError(null)
    try {
      // Only typed values are sent; already-saved/staged fields left blank
      // keep their existing Secrets Manager entry (the backend skips empty values).
      await api.saveEnvVars(projectId, { values: secretValues, extra_vars: extraVars })
      onDone?.()
    } catch (err) {
      setSaveError(err.data?.error || 'Failed to save secrets — please try again.')
    } finally {
      setSavingEnvVars(false)
    }
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
