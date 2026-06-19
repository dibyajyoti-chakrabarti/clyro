import { useEffect, useState } from 'react'
import { api } from '../../../../api'
import AwsConnectCard from './AwsConnectCard'
import DeploymentSuccess from './DeploymentSuccess'
import EnvVarsPanel from './EnvVarsPanel'
import ProvisionLog from './ProvisionLog'
import ReviewArchitecture from './ReviewArchitecture'

function StepFourPanel({ projectId, setStep4CanContinue, onAdvanceToStepFive }) {
  const [phase, setPhase] = useState('aws_connect')

  // aws_connect phase
  const [cfnConsoleUrl, setCfnConsoleUrl] = useState(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const [stackOpened, setStackOpened] = useState(false)
  const [arnInput, setArnInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState(null)
  const [roleConnected, setRoleConnected] = useState(false)

  // env_vars phase
  const [envVarsLoading, setEnvVarsLoading] = useState(false)
  const [userSecretVars, setUserSecretVars] = useState([])
  const [generatedVars, setGeneratedVars] = useState([])
  const [secretValues, setSecretValues] = useState({})
  const [showSecrets, setShowSecrets] = useState({})
  const [extraVars, setExtraVars] = useState([])
  const [savingEnvVars, setSavingEnvVars] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // provisioning / review
  const [showTemplate, setShowTemplate] = useState(false)
  const [provisioningLog, setProvisioningLog] = useState([])
  const [cfTemplate, setCfTemplate] = useState('')
  const [copiedKey, setCopiedKey] = useState('')

  useEffect(() => {
    setStep4CanContinue(phase === 'success')
  }, [phase, setStep4CanContinue])

  // Fetch CloudFormation console URL on mount
  useEffect(() => {
    if (!projectId) return
    setUrlLoading(true)
    api.initAwsConnection(projectId)
      .then((data) => setCfnConsoleUrl(data.cfn_console_url))
      .catch(() => {})
      .finally(() => setUrlLoading(false))
  }, [projectId])

  // Fetch env vars when entering env_vars phase
  useEffect(() => {
    if (phase !== 'env_vars' || !projectId) return
    setEnvVarsLoading(true)
    api.getEnvVars(projectId)
      .then((data) => {
        setUserSecretVars(data.user_secret || [])
        setGeneratedVars(data.generated || [])
      })
      .catch(() => {})
      .finally(() => setEnvVarsLoading(false))
  }, [phase, projectId])

  const allSecretsFilled = userSecretVars.length === 0 || userSecretVars.every(
    (field) => (secretValues[field.key_name] || '').trim() !== ''
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
      await api.saveEnvVars(projectId, { values: secretValues, extra_vars: extraVars })
      setPhase('review')
    } catch (err) {
      setSaveError(err.data?.error || 'Failed to save secrets — please try again.')
    } finally {
      setSavingEnvVars(false)
    }
  }

  const handleCopy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(''), 300)
    } catch {
      setCopiedKey('')
    }
  }

  if (phase === 'aws_connect') {
    return (
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
        onContinue={() => setPhase('env_vars')}
      />
    )
  }

  if (phase === 'env_vars') {
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
          const next = [...extraVars]
          next[index] = { ...next[index], [field]: value }
          setExtraVars(next)
        }}
        onContinue={handleSaveEnvVars}
      />
    )
  }

  if (phase === 'review') {
    return (
      <ReviewArchitecture
        showTemplate={showTemplate}
        cfTemplate={cfTemplate}
        onToggleTemplate={() => setShowTemplate((prev) => !prev)}
        onEditArchitecture={() => setPhase('env_vars')}
        onProvision={() => setPhase('provisioning')}
      />
    )
  }

  if (phase === 'provisioning') {
    return <ProvisionLog provisioningLog={provisioningLog} />
  }

  return (
    <DeploymentSuccess
      copiedKey={copiedKey}
      onCopy={handleCopy}
      onGoToDashboard={() => {
        setStep4CanContinue(true)
        onAdvanceToStepFive()
      }}
    />
  )
}

export default StepFourPanel
