import { useState } from 'react'
import { api, pollJob } from '../api'
import { hasInfra } from '../lib/projectStatus'
import ConfirmDialog from '../components/ui/ConfirmDialog'

// Shared delete-project flow (Projects list + Dashboard): a design-system
// confirm modal (typed-name confirm for live projects), the async AWS purge, a
// poll of the delete job, and dropping the row from local state. Consumers
// render the returned `dialog` element and call `confirmDelete(project)`.
export default function useProjectDeletion(setProjects) {
  const [deletingIds, setDeletingIds] = useState(() => new Set())
  const [target, setTarget] = useState(null) // project pending confirmation
  const [busy, setBusy] = useState(false)

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

  // Open the confirm modal for a project. Accepts a project object (preferred)
  // or a bare id for backwards compatibility.
  const confirmDelete = (projectOrId) => {
    const project =
      typeof projectOrId === 'string' ? { id: projectOrId, name: '' } : projectOrId
    setTarget(project)
  }

  const handleConfirm = async () => {
    if (!target) return
    const id = target.id
    setBusy(true)
    // Kick the delete, then close the modal — the row shows its own spinner via
    // deletingIds while the purge runs in the background.
    runDelete(id)
    setBusy(false)
    setTarget(null)
  }

  // A reload mid-delete leaves projects at status 'deleting' with no local
  // poll — re-attach (the DELETE endpoint reuses the in-flight job).
  const resumeDeletions = (list) => {
    list.filter((p) => p.status === 'deleting').forEach((p) => runDelete(p.id))
  }

  const live = target ? hasInfra(target.status) : false

  const dialog = (
    <ConfirmDialog
      open={Boolean(target)}
      title='Delete project'
      description={
        live
          ? 'This project has live infrastructure. Deleting it tears down all AWS resources, deletes its secrets, removes the Clyro connector stack, and removes the project. This cannot be undone.'
          : 'Delete this project? Its AWS infrastructure, secrets and the Clyro connector stack will be permanently deleted. This cannot be undone.'
      }
      consequences={[
        'All provisioned AWS infrastructure (CloudFormation stack + resources)',
        'Stored secrets in AWS Secrets Manager',
        'The Clyro connector (bootstrap) stack',
        'The project record itself',
      ]}
      confirmText='Delete project'
      loading={busy}
      requireTyped={live && target?.name ? target.name : undefined}
      onCancel={() => setTarget(null)}
      onConfirm={handleConfirm}
    />
  )

  return { deletingIds, confirmDelete, resumeDeletions, dialog }
}
