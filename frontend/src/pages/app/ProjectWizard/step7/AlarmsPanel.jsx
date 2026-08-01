import { BellRing } from 'lucide-react'
import MonitorCard from './MonitorCard'

// Notification state + the 30-day firing history for the stack's CloudWatch
// alarms. The alarm rules themselves render in the Alerts card; both read the
// same `data` from useAlarms.
function AlarmsPanel({ data, className = '' }) {
  const usable = data && data.stack_status === 'ok'
  const history = usable ? (data.history || []) : []

  return (
    <MonitorCard title='Alarms & notifications' className={className}>
      {!usable ? (
        <p className='flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-surface/40 px-4 py-4 text-center text-sm text-text-muted'>
          Waiting for alarm data from the stack…
        </p>
      ) : (
        <>
          {(data.warnings || []).map((warning) => (
            <p key={warning} className='mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300'>{warning}</p>
          ))}
          {data.subscription === 'pending' ? (
            <p className='mb-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.14] to-amber-500/[0.04] px-3 py-2 text-xs leading-relaxed text-amber-300'>
              <BellRing className='mt-0.5 h-4 w-4 shrink-0' />
              Alert emails are almost ready — click the confirmation link AWS sent to your inbox.
            </p>
          ) : null}
          {!data.configured ? (
            <p className='flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-surface/40 px-4 py-4 text-center text-sm text-text-muted'>
              No alarms in this stack yet — they're created the next time you provision.
            </p>
          ) : history.length > 0 ? (
            <div className='flex min-h-0 flex-1 flex-col'>
              <p className='text-[10px] font-semibold uppercase tracking-wider text-text-muted'>Last 30 days</p>
              <div className='mt-2 max-h-56 space-y-1 overflow-auto pr-1'>
                {history.slice(0, 8).map((item, index) => (
                  <p key={index} className='text-xs leading-relaxed text-text-muted'>
                    <span className='text-text-primary'>{item.at ? new Date(item.at).toLocaleString() : ''}</span>
                    {' — '}{item.summary}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <p className='text-xs text-text-muted'>Nothing has fired in the last 30 days.</p>
          )}
        </>
      )}
    </MonitorCard>
  )
}

export default AlarmsPanel
