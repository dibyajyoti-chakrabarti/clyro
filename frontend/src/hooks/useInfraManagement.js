import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api'

// Standalone infra lifecycle controller for a single project — pause / resume /
// teardown, plus a self-contained poll that tracks a teardown through to
// 'deleted'. Used by the projects list / dashboard "Manage infra" panel, where
// (unlike the wizard) there is no ambient provisioning poll to piggyback on.
export default function useInfraManagement(projectId, { initialStatus, onDeleted } = {}) {
  const [deployStatus, setDeployStatus] = useState(initialStatus)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const pollRef = useRef(null)

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => clearPoll, [])

  // Pull the authoritative deploy status (list rows only carry project.status).
  const refresh = useCallback(async () => {
    try {
      const data = await api.getDeployStatus(projectId)
      setDeployStatus(data.status)
    } catch {
      /* leave the optimistic initialStatus in place */
    }
  }, [projectId])

  const run = useCallback(
    async (fn, failMsg) => {
      setError(null)
      setLoading(true)
      try {
        const data = await fn()
        if (data?.status) setDeployStatus(data.status)
        return data
      } catch (err) {
        setError(err.data?.error || err.message || failMsg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const pause = useCallback(
    () => run(() => api.pauseDeploy(projectId), 'Failed to pause infrastructure.'),
    [run, projectId],
  )

  const resume = useCallback(
    () => run(() => api.resumeDeploy(projectId), 'Failed to resume infrastructure.'),
    [run, projectId],
  )

  const teardown = useCallback(async () => {
    await run(() => api.teardownDeploy(projectId), 'Failed to delete infrastructure.')
    setDeployStatus('deleting')
    clearPoll()
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getDeployStatus(projectId)
        setDeployStatus(data.status)
        if (data.status === 'deleted' || data.status === 'failed') {
          clearPoll()
          if (data.status === 'deleted') onDeleted?.()
        }
      } catch {
        /* keep polling — transient errors during teardown are expected */
      }
    }, 3000)
  }, [run, projectId, onDeleted])

  return { deployStatus, loading, error, refresh, pause, resume, teardown }
}
