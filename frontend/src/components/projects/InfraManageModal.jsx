import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import useInfraManagement from '../../hooks/useInfraManagement'
import { statusMeta } from '../../lib/projectStatus'
import ManageInfrastructurePanel from './ManageInfrastructurePanel'
import ConfirmDialog from '../ui/ConfirmDialog'

// Standalone "Manage infrastructure" modal for a live/paused project — lets the
// user Pause / Resume / tear down provisioned AWS resources without re-entering
// the 7-step wizard. Reuses the presentational panel + the lifecycle hook.
export default function InfraManageModal({ open, project, onClose, onChanged }) {
  // Seed the panel from the project's coarse status; the hook then refreshes to
  // the authoritative deploy status once mounted.
  const initialStatus = project ? statusMeta(project.status).group : undefined
  const { deployStatus, loading, error, refresh, pause, resume, teardown } = useInfraManagement(
    project?.id,
    { initialStatus, onDeleted: onChanged },
  )
  const [teardownOpen, setTeardownOpen] = useState(false)

  useEffect(() => {
    if (open && project?.id) refresh()
  }, [open, project?.id, refresh])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape' && !loading) onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, loading, onClose])

  if (!open || !project) return null

  const confirmTeardown = async () => {
    try {
      await teardown()
      setTeardownOpen(false)
      onChanged?.()
    } catch {
      setTeardownOpen(false)
    }
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm'
      onClick={() => { if (!loading) onClose?.() }}
    >
      <div
        className='w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='mb-4 flex items-start justify-between gap-4'>
          <div className='min-w-0'>
            <h3 className='truncate text-base font-semibold text-text-primary'>{project.name}</h3>
            <p className='mt-0.5 text-xs text-text-muted'>
              {project.repo_full_name || 'Infrastructure management'}
            </p>
          </div>
          <button
            type='button'
            aria-label='Close'
            onClick={onClose}
            className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-muted transition-colors hover:bg-white/[0.06] hover:text-text-primary'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        <ManageInfrastructurePanel
          deployStatus={deployStatus}
          loading={loading}
          error={error}
          onPause={pause}
          onResume={resume}
          onTeardown={() => setTeardownOpen(true)}
        />

        <ConfirmDialog
          open={teardownOpen}
          title='Delete infrastructure'
          description='This permanently deletes all provisioned AWS infrastructure for this project — the CloudFormation stack and every resource it created. The project itself is kept. This cannot be undone.'
          consequences={[
            'The CloudFormation stack and all its resources (ECS, RDS, ALB, S3, CloudFront…)',
            'Any data stored in the database and buckets',
          ]}
          confirmText={loading ? 'Deleting…' : 'Yes, delete infrastructure'}
          loading={loading}
          onCancel={() => setTeardownOpen(false)}
          onConfirm={confirmTeardown}
        />
      </div>
    </div>
  )
}
