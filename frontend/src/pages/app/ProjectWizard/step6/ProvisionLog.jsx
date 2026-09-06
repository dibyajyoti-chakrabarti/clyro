import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Trash2, XCircle } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

const VISIBLE_TAIL = 6

function ProvisionLog({ provisioningLog, deployStatus, deployError, deployCorrecting, onRetry, onRetryBuild, onBack, onCancel, cancelLoading, cancelError, canRecreate, onRecreate }) {
  const [expanded, setExpanded] = useState(false)
  const rawFailed = deployStatus === 'failed' || deployStatus === 'rolled_back'
  const rollingBack = deployStatus === 'rolling_back'
  // A raw failed/rolled_back status isn't necessarily terminal — the backend may
  // still be mid its one-round auto-correction (real AWS error -> refine -> retry).
  const deployFailed = rawFailed && !deployCorrecting
  // The infrastructure itself is up (CFN CREATE_COMPLETE) but the build step
  // that gets the customer's code into it failed — a distinct state from
  // deployFailed: the stack is genuinely live and must not be resubmitted,
  // only the build needs retrying (see StepFour.jsx's handleRetryBuild).
  const building = deployStatus === 'building'
  const buildFailed = deployStatus === 'build_failed'
  // Teardown reuses this screen, so it needs its own two states. Without them
  // both fell through to the final else of the heading chain and the panel sat
  // on "Provisioning infrastructure" with a spinner while the stack was being
  // destroyed — and kept saying it forever once the stack was gone.
  const deleting = deployStatus === 'deleting'
  const deleted = deployStatus === 'deleted'
  const isCancelable = !rollingBack && !deployFailed && !buildFailed && !deleting && !deleted

  // Track only the latest event per resource — CFN emits both an IN_PROGRESS and a
  // COMPLETE/FAILED event per resource, so counting raw log rows overstates the total.
  const { total, done, failed, rolledBack } = useMemo(() => {
    const latest = new Map()
    for (const entry of provisioningLog) {
      if (entry.resource_id) latest.set(entry.resource_id, entry.status)
    }
    let done = 0
    let failed = 0
    let rolledBack = 0
    for (const status of latest.values()) {
      if (status === 'done') done += 1
      else if (status === 'failed') failed += 1
      else if (status === 'rolled_back') rolledBack += 1
    }
    return { total: latest.size, done, failed, rolledBack }
  }, [provisioningLog])

  const pct = total > 0 ? Math.round(((done + failed + rolledBack) / total) * 100) : 0
  const visibleLog = expanded ? provisioningLog : provisioningLog.slice(-VISIBLE_TAIL)
  const hiddenCount = provisioningLog.length - visibleLog.length

  return (
    <WizardPanel>
      <WizardCard width='lg'>
        <div className='flex items-center gap-2'>
          {deployFailed || buildFailed ? (
            <XCircle className='h-5 w-5 text-red-400' />
          ) : deleted ? (
            <Check className='h-5 w-5 text-text-muted' />
          ) : (
            <span className='h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin' />
          )}
          <h3 className='text-lg font-semibold'>
            {deleted
              ? 'Infrastructure deleted'
              : deleting
              ? 'Deleting infrastructure…'
              : deployFailed
              ? 'Provisioning failed'
              : rollingBack
                ? 'Provisioning failed, rolling back…'
                : buildFailed
                ? 'Build failed'
                : rawFailed && deployCorrecting
                  ? 'Deploy failed, retrying with a correction…'
                  : building
                    ? 'Building your application…'
                    : 'Provisioning infrastructure'}
          </h3>
        </div>
        {deleted ? (
          <p className='mt-1 text-sm text-text-muted'>
            Every resource this project provisioned has been removed from your AWS account,
            and it has stopped billing. You can provision it again whenever you want.
          </p>
        ) : deleting ? (
          <p className='mt-1 text-sm text-text-muted'>
            AWS is removing the CloudFormation stack and everything it created. This usually
            takes 5 to 10 minutes, and finishes on its own if you close this tab.
          </p>
        ) : rollingBack ? (
          <p className='mt-1 text-sm text-text-muted'>
            AWS is removing the resources from the failed attempt. Clyro will report the
            root cause once rollback completes.
          </p>
        ) : rawFailed && deployCorrecting ? (
          <p className='mt-1 text-sm text-text-muted'>
            The last attempt hit a real AWS error. Applying one correction automatically and
            retrying before giving up.
          </p>
        ) : building ? (
          <p className='mt-1 text-sm text-text-muted'>
            Your infrastructure is up. Compiling and pushing your code to it now. This
            usually takes 2 to 5 minutes.
          </p>
        ) : buildFailed ? (
          <p className='mt-1 text-sm text-text-muted'>
            Your infrastructure is live, but the build didn't complete. Check the error below,
            fix it in your repo, and retry the build (no need to re-provision).
          </p>
        ) : !deployFailed ? (
          <p className='mt-1 text-sm text-text-muted'>This typically takes 8 to 12 minutes. You can keep this tab open.</p>
        ) : null}

        {/* ── Progress summary ── */}
        {total > 0 && !deleting && !deleted && (
          <div className='mt-4 space-y-1.5'>
            <div className='flex items-center justify-between text-xs text-text-muted'>
              <span>{done + failed + rolledBack} of {total} resources processed{failed ? ` · ${failed} failed` : ''}{rolledBack ? ` · ${rolledBack} rolled back` : ''}</span>
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
            const isRolledBack = entry.status === 'rolled_back'
            const textClass = isFailed
              ? 'text-red-300'
              : isRolledBack
                ? 'text-amber-300'
                : isDone
                  ? 'text-text-primary'
                  : isActive
                    ? 'text-accent'
                    : 'text-text-muted'

            return (
              <div key={entry.sequence} className='flex items-start gap-3'>
                {isFailed ? (
                  <span className='mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-red-500/40 bg-red-500/15 text-red-300'>
                    <XCircle className='h-3.5 w-3.5' />
                  </span>
                ) : isRolledBack ? (
                  <span className='mt-0.5 grid h-5 w-5 place-items-center rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300'>
                    <AlertTriangle className='h-3 w-3' />
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
              {/* When an in-place retry can't fix the failure (e.g. a stateful
                  resource needs a different creation-time property like RDS
                  DBName) and the stack has never gone live, offer a clean
                  teardown + reprovision. Gated by the backend (can_recreate). */}
              {canRecreate ? (
                <Button variant='secondary' onClick={onRecreate}>
                  Rebuild from scratch
                </Button>
              ) : null}
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
        ) : deleted ? (
          <div className='mt-5 flex items-center gap-4'>
            <Button variant='primary' onClick={onBack}>
              Back to review
              <ArrowRight className='h-4 w-4' />
            </Button>
          </div>
        ) : buildFailed ? (
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
              <Button variant='primary' onClick={onRetryBuild}>
                Retry build
                <ArrowRight className='h-4 w-4' />
              </Button>
              <button
                type='button'
                onClick={onCancel}
                disabled={cancelLoading}
                className='flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-red-300 disabled:opacity-50'
              >
                <Trash2 className='h-3.5 w-3.5' />
                {/* No "leftover" here — unlike deployFailed, the stack is genuinely
                    live and working, just missing application code. */}
                {cancelLoading ? 'Cleaning up…' : 'Delete infrastructure'}
              </button>
            </div>
          </div>
        ) : null}
      </WizardCard>
    </WizardPanel>
  )
}

export default ProvisionLog
