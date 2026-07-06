import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Trash2, XCircle } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

const VISIBLE_TAIL = 6

function ProvisionLog({ provisioningLog, deployStatus, deployError, deployCorrecting, onRetry, onBack, onCancel, cancelLoading, cancelError }) {
  const [expanded, setExpanded] = useState(false)
  const rawFailed = deployStatus === 'failed' || deployStatus === 'rolled_back'
  // A raw failed/rolled_back status isn't necessarily terminal — the backend may
  // still be mid its one-round auto-correction (real AWS error -> refine -> retry).
  const deployFailed = rawFailed && !deployCorrecting
  const isCancelable = !deployFailed && deployStatus !== 'deleting' && deployStatus !== 'deleted'

  // Track only the latest event per resource — CFN emits both an IN_PROGRESS and a
  // COMPLETE/FAILED event per resource, so counting raw log rows overstates the total.
  const { total, done, failed } = useMemo(() => {
    const latest = new Map()
    for (const entry of provisioningLog) {
      if (entry.resource_id) latest.set(entry.resource_id, entry.status)
    }
    let done = 0
    let failed = 0
    for (const status of latest.values()) {
      if (status === 'done') done += 1
      else if (status === 'failed') failed += 1
    }
    return { total: latest.size, done, failed }
  }, [provisioningLog])

  const pct = total > 0 ? Math.round(((done + failed) / total) * 100) : 0
  const visibleLog = expanded ? provisioningLog : provisioningLog.slice(-VISIBLE_TAIL)
  const hiddenCount = provisioningLog.length - visibleLog.length

  return (
    <WizardPanel>
      <WizardCard width='lg'>
        <div className='flex items-center gap-2'>
          {deployFailed ? (
            <XCircle className='h-5 w-5 text-red-400' />
          ) : (
            <span className='h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
          )}
          <h3 className='text-lg font-semibold'>
            {deployFailed
              ? 'Provisioning failed'
              : rawFailed && deployCorrecting
                ? 'Deploy failed — retrying with a correction…'
                : 'Provisioning infrastructure'}
          </h3>
        </div>
        {rawFailed && deployCorrecting ? (
          <p className='mt-1 text-sm text-text-muted'>
            The last attempt hit a real AWS error — automatically applying one correction and
            retrying before giving up.
          </p>
        ) : !deployFailed ? (
          <p className='mt-1 text-sm text-text-muted'>This typically takes 8–12 minutes — you can keep this tab open.</p>
        ) : null}

        {/* ── Progress summary ── */}
        {total > 0 && (
          <div className='mt-4 space-y-1.5'>
            <div className='flex items-center justify-between text-xs text-text-muted'>
              <span>{done + failed} of {total} resources processed{failed ? ` · ${failed} failed` : ''}</span>
              <span>{pct}%</span>
            </div>
            <div className='h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]'>
              <div
                className={`h-full rounded-full transition-all duration-500 ${failed ? 'bg-red-400' : 'bg-accent'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Cancel mid-flight ── */}
        {isCancelable && (
          <div className='mt-4'>
            <button
              type='button'
              onClick={onCancel}
              disabled={cancelLoading}
              className='flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-red-300 disabled:opacity-50'
            >
              <Trash2 className='h-3.5 w-3.5' />
              {cancelLoading ? 'Cancelling…' : 'Cancel & delete infrastructure'}
            </button>
            {cancelError && <p className='mt-1 text-xs text-red-400'>{cancelError}</p>}
          </div>
        )}

        {/* ── Detail log (collapsed to the last few events by default) ── */}
        <div className='mt-4 space-y-3'>
          {!expanded && hiddenCount > 0 && (
            <button
              type='button'
              onClick={() => setExpanded(true)}
              className='flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary'
            >
              <ChevronDown className='h-3.5 w-3.5' />
              Show {hiddenCount} earlier event{hiddenCount > 1 ? 's' : ''}
            </button>
          )}
          {expanded && provisioningLog.length > VISIBLE_TAIL && (
            <button
              type='button'
              onClick={() => setExpanded(false)}
              className='flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary'
            >
              <ChevronUp className='h-3.5 w-3.5' />
              Collapse
            </button>
          )}

          {provisioningLog.length === 0 ? (
            <p className='text-sm text-text-muted'>Submitting your template to AWS…</p>
          ) : visibleLog.map((entry) => {
            const isDone = entry.status === 'done'
            const isActive = entry.status === 'in_progress'
            const isFailed = entry.status === 'failed'
            const textClass = isFailed ? 'text-red-300' : isDone ? 'text-text-primary' : isActive ? 'text-accent' : 'text-text-muted'

            return (
              <div key={entry.sequence} className='flex items-start gap-3'>
                {isFailed ? (
                  <span className='mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-red-500/40 bg-red-500/15 text-red-300'>
                    <XCircle className='h-3.5 w-3.5' />
                  </span>
                ) : isDone ? (
                  <span className='mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-green-500/40 bg-green-500/15 text-green-300'>
                    <Check className='h-3 w-3' strokeWidth={3} />
                  </span>
                ) : isActive ? (
                  <span className='mt-0.5 h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin' />
                ) : (
                  <span className='mt-0.5 h-5 w-5 rounded-full border border-border bg-background' />
                )}
                <p className={`text-sm ${textClass}`}>{entry.plain_message}</p>
              </div>
            )
          })}
        </div>

        {deployFailed ? (
          <div className='mt-5'>
            {deployError ? (
              <p className='flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300'>
                <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
                {deployError}
              </p>
            ) : null}
            <div className='mt-4 flex items-center gap-4'>
              <button
                type='button'
                className='inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary'
                onClick={onBack}
              >
                <ArrowLeft className='h-4 w-4' />
                Back
              </button>
              <Button variant='primary' onClick={onRetry}>
                Retry
                <ArrowRight className='h-4 w-4' />
              </Button>
              <button
                type='button'
                onClick={onCancel}
                disabled={cancelLoading}
                className='flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-red-300 disabled:opacity-50'
              >
                <Trash2 className='h-3.5 w-3.5' />
                {cancelLoading ? 'Cleaning up…' : 'Delete leftover infrastructure'}
              </button>
            </div>
          </div>
        ) : null}
      </WizardCard>
    </WizardPanel>
  )
}

export default ProvisionLog
