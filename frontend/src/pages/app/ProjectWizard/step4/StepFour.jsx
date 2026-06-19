import { useEffect, useState } from 'react'
import AwsConnectCard from './AwsConnectCard'
import DeploymentSuccess from './DeploymentSuccess'
import EnvVarsPanel from './EnvVarsPanel'
import ProvisionLog from './ProvisionLog'
import ReviewArchitecture from './ReviewArchitecture'

function StepFourPanel({ setStep4CanContinue, onAdvanceToStepFive }) {
  const [phase, setPhase] = useState('aws_connect')
  const [isWaitingRole, setIsWaitingRole] = useState(false)
  const [roleConnected, setRoleConnected] = useState(false)
  const [userSecretVars, setUserSecretVars] = useState([]) // TODO: fetch from GET /api/projects/{id}/env-vars/?classification=user_secret
  const [generatedVars, setGeneratedVars] = useState([])   // TODO: fetch from GET /api/projects/{id}/env-vars/?classification=generated
  const [secretValues, setSecretValues] = useState({})
  const [showSecrets, setShowSecrets] = useState({})
  const [extraVars, setExtraVars] = useState([])
  const [showTemplate, setShowTemplate] = useState(false)
  const [provisioningLog, setProvisioningLog] = useState([]) // TODO: poll GET /api/deployments/{id}/log/
  const [cfTemplate, setCfTemplate] = useState('') // TODO: fetch from GET /api/deployments/{id}/template/
  const [copiedKey, setCopiedKey] = useState('')

  useEffect(() => {
    setStep4CanContinue(phase === 'success')
  }, [phase, setStep4CanContinue])

  const allSecretsFilled = userSecretVars.length === 0 || userSecretVars.every(
    (field) => (secretValues[field.key_name] || '').trim() !== ''
  )

  const handleRoleConnect = () => {
    setIsWaitingRole(true)
    setRoleConnected(false)
    // TODO: call POST /api/projects/{id}/aws-connection/verify/
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
        handleRoleConnect={handleRoleConnect}
        isWaitingRole={isWaitingRole}
        roleConnected={roleConnected}
        onContinue={() => setPhase('env_vars')}
      />
    )
  }

  if (phase === 'env_vars') {
    return (
      <EnvVarsPanel
        userSecretVars={userSecretVars}
        generatedVars={generatedVars}
        secretValues={secretValues}
        showSecrets={showSecrets}
        extraVars={extraVars}
        allSecretsFilled={allSecretsFilled}
        onSecretValueChange={(keyName, value) => setSecretValues((prev) => ({ ...prev, [keyName]: value }))}
        onToggleSecretVisibility={(keyName) => setShowSecrets((prev) => ({ ...prev, [keyName]: !prev[keyName] }))}
        onAddVariable={() => setExtraVars((prev) => [...prev, { key: '', value: '' }])}
        onExtraVariableChange={(index, field, value) => {
          const next = [...extraVars]
          next[index] = { ...next[index], [field]: value }
          setExtraVars(next)
        }}
        onContinue={() => setPhase('review')}
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
