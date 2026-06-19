import GithubConnectCard from './GithubConnectCard'
import RepositorySelector from './RepositorySelector'
import ScanProgress from './ScanProgress'
import ScanBlocked from './ScanBlocked'
import ScanResults from './ScanResults'
import useScanFlow from '../hooks/useScanFlow'

export default function StepOnePanel({ projectId, projectData, setProjectData, setStep1CanContinue }) {
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

  return <ScanResults selectedRepo={selectedRepo} selectedBranch={selectedBranch} isMonorepo={isMonorepo} detectedServices={detectedServices} detectedInfra={detectedInfra} generated={generated} userSecrets={userSecrets} optional={optional} />
}
