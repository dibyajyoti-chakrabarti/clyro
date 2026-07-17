import GithubConnectCard from './GithubConnectCard'
import RepositorySelector from './RepositorySelector'
import ScanProgress from './ScanProgress'
import ScanBlocked from './ScanBlocked'
import ScanResults from './ScanResults'
import SecretsCollect from './SecretsCollect'
import useScanFlow from '../hooks/useScanFlow'

// Step 1: connect the repo, scan it, then stage the secrets it needs — all
// before any AWS account is connected (that's Step 2). Self-manages its own
// advance to Step 2 via onComplete once secrets are staged, since it spans
// two internal sub-phases (scan results -> secrets) behind one wizard step.
export default function StepOnePanel({ projectId, projectData, setProjectData, setStep1CanContinue, onComplete }) {
  const {
    phase,
    setPhase,
    selectedRepo,
    selectedBranch,
    loadingRepos,
    loadingBranches,
    availableRepos,
    availableBranches,
    existingInstallations,
    handleInstall,
    handleUseExisting,
    handleRepoChange,
    setSelectedBranch,
    handleScan,
    canScan,
    blockReason,
    scanMessages,
    scanStep,
    isMonorepo,
    detectedServices,
    detectedInfra,
    envVars,
    generated,
    userSecrets,
    optional,
    complianceFindings,
    compliancePrompt,
  } = useScanFlow({ projectId, projectData, setProjectData, setStep1CanContinue })

  if (phase === 'connect') {
    return <GithubConnectCard existingInstallations={existingInstallations} handleInstall={handleInstall} handleUseExisting={handleUseExisting} />
  }

  if (phase === 'select') {
    return <RepositorySelector loadingRepos={loadingRepos} selectedRepo={selectedRepo} loadingBranches={loadingBranches} selectedBranch={selectedBranch} availableRepos={availableRepos} availableBranches={availableBranches} handleRepoChange={handleRepoChange} setSelectedBranch={setSelectedBranch} setPhase={setPhase} handleScan={handleScan} canScan={canScan} />
  }

  if (phase === 'scanning') {
    return <ScanProgress scanMessages={scanMessages} scanStep={scanStep} />
  }

  if (phase === 'blocked') {
    return <ScanBlocked blockReason={blockReason} setPhase={setPhase} />
  }

  if (phase === 'secrets') {
    return <SecretsCollect projectId={projectId} onDone={onComplete} />
  }

  const hasBlockingFindings = complianceFindings.some((f) => !f.passed && f.severity === 'blocker')

  return (
    <ScanResults
      selectedRepo={selectedRepo}
      selectedBranch={selectedBranch}
      isMonorepo={isMonorepo}
      detectedServices={detectedServices}
      detectedInfra={detectedInfra}
      generated={generated}
      userSecrets={userSecrets}
      optional={optional}
      envVars={envVars}
      complianceFindings={complianceFindings}
      compliancePrompt={compliancePrompt}
      canContinue={!hasBlockingFindings}
      onContinue={() => setPhase('secrets')}
    />
  )
}
