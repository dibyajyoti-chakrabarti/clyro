import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

function AlertsList({ alerts }) {
  return (
    <div>
      <div className='flex items-center gap-2'>
        <h3 className='text-lg font-semibold'>Alerts</h3>
        {alerts.length > 0 ? (
          <span className='rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300'>{alerts.length}</span>
        ) : null}
      </div>
      <div className='mt-3 space-y-2'>
        {alerts.length === 0 ? (
          <p className='flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-3 text-sm text-text-muted'>
            <CheckCircle2 className='h-4 w-4 text-success' />
            No active alerts — everything looks healthy.
          </p>
        ) : (
          alerts.map((alert) => {
            const critical = alert.severity === 'critical'
            const Icon = critical ? XCircle : AlertTriangle
            return (
              <div
                key={alert.id}
                className={`rounded-lg border border-l-4 bg-surface p-3 ${critical ? 'border-red-500/30 border-l-red-400' : 'border-amber-500/30 border-l-amber-400'}`}
              >
                <div className='flex items-start gap-2'>
                  <Icon className={`mt-0.5 h-4 w-4 ${critical ? 'text-red-400' : 'text-amber-300'}`} />
                  <div>
                    <p className='text-sm font-medium text-text-primary'>{alert.plain_message}</p>
                    <p className='mt-1 text-xs text-text-muted'>{alert.fired_at}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default AlertsList
