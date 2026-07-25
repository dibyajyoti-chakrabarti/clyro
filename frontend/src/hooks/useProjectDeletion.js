import { useState } from 'react'
import { api, pollJob } from '../api'

// Shared delete-project flow (Projects list + Dashboard): confirm, kick the
// async AWS purge, poll the delete job, drop the row from local state.
export default function useProjectDeletion(setProjects) {
  const [deletingIds, setDeletingIds] = useState(() => new Set())

  const setDeleting = (id, on) => {
    setDeletingIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const runDelete = async (id) => {
    setDeleting(id, true)
    try {
      const res = await api.deleteProject(id)
      if (res && res.job_id) {
        // Async full purge — the job row itself is deleted with the project,
        // so the poll finishing in a 404 is the success signal.
        try {
          await pollJob(id, res.job_id)
        } catch (err) {
          if (err.status !== 404) throw err
        }
      }
      setProjects((prev) => prev.filter((project) => project.id !== id))
    } catch (err) {
      window.alert(err.message || 'Failed to delete project')
      api.listProjects().then(setProjects).catch(() => {})
    } finally {
      setDeleting(id, false)
    }
  }

  const confirmDelete = async (id) => {
    const message =
      'Delete this project? Its AWS infrastructure, secrets and the Clyro connector stack ' +
      'will be permanently deleted. This cannot be undone.'
    if (!window.confirm(message)) return
    await runDelete(id)
  }

  // A reload mid-delete leaves projects at status 'deleting' with no local
  // poll — re-attach (the DELETE endpoint reuses the in-flight job).
  const resumeDeletions = (list) => {
    list.filter((p) => p.status === 'deleting').forEach((p) => runDelete(p.id))
  }

  return { deletingIds, confirmDelete, resumeDeletions }
}
