import { useEffect, useState } from 'react'
import { api } from '../../../../api'
import EnvVarsPanel from '../shared/EnvVarsPanel'

// Step 1's secrets sub-phase: stage the app's env vars right after the scan,
// with no AWS account connected yet (that's Step 2). Values are held pending
// here and only written for real to Secrets Manager in Step 6 (SecretsWrite),
// once an AWS account is connected.
export default function SecretsCollect({ projectId, onDone }) {
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
        setUserSecretVars(data.user_secret || [])
        setGeneratedVars(data.generated || [])
      })
      .catch(() => {})
      .finally(() => setEnvVarsLoading(false))
  }, [projectId])

  // A required secret is satisfied if the user typed a value OR it was already
  // staged on a previous visit (resume case) — the saved value never returns
  // to the browser, so the field otherwise renders empty.
  //
  // 'agent_generatable' secrets (CLYRO.md's hint for values that are pure
  // entropy, like DJANGO_SECRET_KEY) are never required: Clyro mints those
  // itself at write time. The input stays, so a user who wants to pin a
  // specific value still can.
  const allSecretsFilled = userSecretVars.length === 0 || userSecretVars.every(
    (field) =>
      field.hint === 'agent_generatable' ||
      field.secrets_manager_arn ||
      (secretValues[field.key_name] || '').trim() !== ''
  )

  const handleStageEnvVars = async () => {
    setSavingEnvVars(true)
    setSaveError(null)
    try {
      // Only typed values are sent; already-staged fields left blank keep
      // their existing staged value (the backend skips empty values).
      await api.stageEnvVars(projectId, { values: secretValues, extra_vars: extraVars })
      onDone?.()
    } catch (err) {
      setSaveError(err.data?.error || 'Failed to save secrets. Please try again.')
    } finally {
      setSavingEnvVars(false)
    }
  }

  return (
    <EnvVarsPanel
      mode='stage'
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
      onContinue={handleStageEnvVars}
    />
  )
}
