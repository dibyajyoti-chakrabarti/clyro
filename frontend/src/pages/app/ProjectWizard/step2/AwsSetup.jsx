import { useEffect, useState } from 'react'
import { api } from '../../../../api'
import AwsConnectCard from './AwsConnectCard'
import EnvVarsPanel from './EnvVarsPanel'

// Step 2's second half: connect the AWS account, then collect the app secrets.
// Both phases used to sit in Step 4 immediately before provisioning; moving them
// here (B3) means the slow ~3–4 min IaC generation in Step 4 no longer waits on
// human input — by the time the user reaches Step 4 the account is connected and
// every secret is already in Secrets Manager.
export default function AwsSetup({ projectId, initiallyConnected, onDone }) {
  const [phase, setPhase] = useState(initiallyConnected ? 'secrets' : 'aws')

  // aws_connect phase state
  const [cfnConsoleUrl, setCfnConsoleUrl] = useState(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const [stackOpened, setStackOpened] = useState(false)
  const [arnInput, setArnInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState(null)
  const [roleConnected, setRoleConnected] = useState(Boolean(initiallyConnected))

  // env_vars phase state
  const [envVarsLoading, setEnvVarsLoading] = useState(false)
  const [userSecretVars, setUserSecretVars] = useState([])
  const [generatedVars, setGeneratedVars] = useState([])
  const [secretValues, setSecretValues] = useState({})
  const [showSecrets, setShowSecrets] = useState({})
  const [extraVars, setExtraVars] = useState([])
  const [savingEnvVars, setSavingEnvVars] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Fetch the CloudFormation console URL only when the user actually needs the
  // connect step and isn't already connected — avoids minting a spurious pending
  // connection on every mount once the account is connected.
  useEffect(() => {
    if (phase !== 'aws' || !projectId || roleConnected || cfnConsoleUrl) return
    setUrlLoading(true)
    api.initAwsConnection(projectId)
      .then((data) => setCfnConsoleUrl(data.cfn_console_url))
      .catch(() => {})
      .finally(() => setUrlLoading(false))
  }, [phase, projectId, roleConnected, cfnConsoleUrl])

  // Load the detected secrets whenever we enter the secrets phase.
  useEffect(() => {
    if (phase !== 'secrets' || !projectId) return
    setEnvVarsLoading(true)
    api.getEnvVars(projectId)
      .then((data) => {
        setUserSecretVars(data.user_secret || [])
        setGeneratedVars(data.generated || [])
      })
      .catch(() => {})
      .finally(() => setEnvVarsLoading(false))
  }, [phase, projectId])

  // A required secret is satisfied if the user typed a value OR it was already
  // written to Secrets Manager on a previous visit (resume case) — the saved
  // value never returns to the browser, so the field otherwise renders empty.
  const allSecretsFilled = userSecretVars.length === 0 || userSecretVars.every(
    (field) => field.secrets_manager_arn || (secretValues[field.key_name] || '').trim() !== ''
  )

  const handleOpenStack = () => {
    if (cfnConsoleUrl) {
      window.open(cfnConsoleUrl, '_blank', 'noopener,noreferrer')
      setStackOpened(true)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setVerifyError(null)
    try {
      await api.verifyAwsConnection(projectId, { role_arn: arnInput.trim(), region: 'us-east-1' })
      setRoleConnected(true)
    } catch (err) {
      setVerifyError(err.data?.error || 'Verification failed — check the role ARN and try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleSaveEnvVars = async () => {
    setSavingEnvVars(true)
    setSaveError(null)
    try {
      // Only typed values are sent; already-saved fields left blank keep their
      // existing Secrets Manager entry (the backend skips empty values).
      await api.saveEnvVars(projectId, { values: secretValues, extra_vars: extraVars })
      onDone?.()
    } catch (err) {
      setSaveError(err.data?.error || 'Failed to save secrets — please try again.')
    } finally {
      setSavingEnvVars(false)
    }
  }

  return (
    <div className='flex h-full min-h-0 w-full flex-col items-center overflow-y-auto py-2'>
      {phase === 'aws' ? (
        <AwsConnectCard
          cfnConsoleUrl={cfnConsoleUrl}
          urlLoading={urlLoading}
          stackOpened={stackOpened}
          arnInput={arnInput}
          setArnInput={setArnInput}
          verifying={verifying}
          verifyError={verifyError}
          roleConnected={roleConnected}
          onOpenStack={handleOpenStack}
          onVerify={handleVerify}
          onContinue={() => setPhase('secrets')}
        />
      ) : (
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
      )}
    </div>
  )
}
