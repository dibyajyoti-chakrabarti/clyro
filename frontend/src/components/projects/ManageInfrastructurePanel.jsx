import { Pause, Play, Trash2 } from 'lucide-react'
import Button from '../ui/Button'

// Presentational "Manage infrastructure" card: Pause / Resume + Delete
// infrastructure. Extracted from the wizard success screen so live infra can be
// managed both inside the wizard (StepSix) and standalone from the projects
// list / dashboard. Stateless — the caller owns the action handlers and the
// teardown confirm dialog.
export default function ManageInfrastructurePanel({
  deployStatus,
  loading = false,
  error,
  onPause,
  onResume,
  onTeardown,
  className = '',
}) {
  const isPaused = deployStatus === 'paused'
  const isDeleting = deployStatus === 'deleting'
  const isDeleted = deployStatus === 'deleted'

  if (isDeleted) {
    return (
      <div className={`rounded-xl border border-white/[0.07] bg-surface p-6 ${className}`.trim()}>
        <h4 className='text-sm font-semibold text-text-primary'>Infrastructure deleted</h4>
        <p className='mt-1 text-xs leading-relaxed text-text-muted'>
          All provisioned resources for this project have been torn down.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border border-white/[0.07] bg-surface p-6 shadow-sm shadow-black/20 sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}
    >
      <div className='min-w-0'>
        <h4 className='text-sm font-semibold text-text-primary'>Manage infrastructure</h4>
        <p className='mt-1 text-xs leading-relaxed text-text-muted'>
          {isPaused
            ? 'Infra is paused. ECS tasks are scaled to 0 and the database is stopped. Nothing is billed for compute while paused.'
            : isDeleting
              ? 'Deleting all provisioned resources…'
              : 'Pause to stop billing without losing anything, or permanently delete the stack.'}
        </p>
        {error && <p className='mt-2 text-xs text-red-400'>{error}</p>}
      </div>
      <div className='flex shrink-0 flex-wrap gap-2'>
        {isPaused ? (
          <Button variant='secondary' disabled={loading} onClick={onResume}>
            <Play className='h-4 w-4' />
            Resume
          </Button>
        ) : (
          <Button variant='secondary' disabled={loading || isDeleting} onClick={onPause}>
            <Pause className='h-4 w-4' />
            Pause
          </Button>
        )}
        <Button variant='danger' disabled={loading || isDeleting} onClick={onTeardown}>
          <Trash2 className='h-4 w-4' />
          {isDeleting ? 'Deleting…' : 'Delete infrastructure'}
        </Button>
      </div>
    </div>
  )
}
