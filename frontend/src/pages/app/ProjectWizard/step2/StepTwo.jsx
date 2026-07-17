import AwsSetup from './AwsSetup'

// Step 2: connect your AWS account. Thin wrapper — AwsSetup owns all the
// connect/verify state; this just threads the wizard's projectData/callback
// plumbing the way step1/StepOne.jsx does for useScanFlow.
export default function StepTwoPanel({ projectId, projectData, setProjectData, setStep2CanContinue, onBack, onContinue }) {
  return (
    <AwsSetup
      projectId={projectId}
      initialAccountType={projectData?.connection?.account_type}
      initiallyConnected={projectData?.connection?.connected}
      onConnected={({ connected, accountType }) => {
        setStep2CanContinue(connected)
        setProjectData((prev) => ({
          ...prev,
          connection: { ...prev.connection, connected, account_type: accountType },
        }))
      }}
      onBack={onBack}
      onContinue={onContinue}
    />
  )
}
