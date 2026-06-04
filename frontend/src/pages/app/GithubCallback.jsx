import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'

export default function GithubCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const installationId = searchParams.get('installation_id')
    const setupAction = searchParams.get('setup_action')

    if (!installationId || setupAction !== 'install') {
      setError('Invalid callback — missing installation_id or unexpected setup_action.')
      return
    }

    const projectId = localStorage.getItem('github_install_project_id')

    api
      .storeInstallation(parseInt(installationId, 10))
      .then(() => {
        localStorage.removeItem('github_install_project_id')
        if (projectId) {
          navigate(`/app/projects/${projectId}?installation_id=${installationId}`, { replace: true })
        } else {
          navigate('/app/projects', { replace: true })
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to store GitHub installation.')
      })
  }, [])

  if (error) {
    return (
      <div className='flex min-h-[calc(100vh-121px)] items-center justify-center'>
        <div className='max-w-sm text-center'>
          <p className='text-sm font-medium text-red-400'>{error}</p>
          <button
            className='mt-4 text-sm text-text-muted underline hover:text-text-primary'
            onClick={() => navigate('/app/projects')}
          >
            Go to Projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='flex min-h-[calc(100vh-121px)] items-center justify-center'>
      <p className='text-sm text-text-muted'>Connecting GitHub App&hellip;</p>
    </div>
  )
}
