import { useEffect, useState } from 'react'
import { api } from '../../../../api'
import AwsConnectCard from './AwsConnectCard'

// Step 2: connect + verify the AWS account. This is now its own step, up front
// (before the intent chat, canvas, and IaC generation) — connecting AWS no
// longer gates IaC generation, which is fully offline, but the user's account
// type still needs to be captured here so verification can flag a mismatch
// between what they picked and what the account actually is.
export default function AwsSetup({ projectId, initialAccountType, initiallyConnected, onConnected, onBack, onContinue }) {
  const [accountType, setAccountType] = useState(initialAccountType || 'paid')
  const [cfnConsoleUrl, setCfnConsoleUrl] = useState(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const [stackOpened, setStackOpened] = useState(false)
  const [arnInput, setArnInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState(null)
  const [roleConnected, setRoleConnected] = useState(Boolean(initiallyConnected))
  const [accountTypeMismatch, setAccountTypeMismatch] = useState(false)

  // Fetch the CloudFormation console URL only when the user actually needs the
  // connect step and isn't already connected — avoids minting a spurious pending
  // connection on every mount once the account is connected.
  useEffect(() => {
    if (!projectId || roleConnected || cfnConsoleUrl) return
    setUrlLoading(true)
    api.initAwsConnection(projectId)
      .then((data) => setCfnConsoleUrl(data.cfn_console_url))
      .catch(() => {})
      .finally(() => setUrlLoading(false))
  }, [projectId, roleConnected, cfnConsoleUrl])

  useEffect(() => {
    onConnected?.({ connected: roleConnected, accountType })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleConnected])

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
      // account_type is the user's self-report, sent alongside the role ARN so
      // the backend can compare it against the account's actual verified plan
      // type (queried live from AWS) and flag account_type_mismatch if they differ.
      const data = await api.verifyAwsConnection(projectId, {
        role_arn: arnInput.trim(),
        region: 'us-east-1',
        account_type: accountType,
      })
      setRoleConnected(true)
      setAccountTypeMismatch(Boolean(data?.account_type_mismatch))
    } catch (err) {
      setVerifyError(err.data?.error || 'Verification failed — check the role ARN and try again.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className='flex h-full min-h-0 w-full flex-col items-center overflow-y-auto py-2'>
      <AwsConnectCard
        accountType={accountType}
        onAccountTypeChange={setAccountType}
        cfnConsoleUrl={cfnConsoleUrl}
        urlLoading={urlLoading}
        stackOpened={stackOpened}
        arnInput={arnInput}
        setArnInput={setArnInput}
        verifying={verifying}
        verifyError={verifyError}
        roleConnected={roleConnected}
        accountTypeMismatch={accountTypeMismatch}
        onOpenStack={handleOpenStack}
        onVerify={handleVerify}
        onBack={onBack}
        onContinue={onContinue}
      />
    </div>
  )
}
