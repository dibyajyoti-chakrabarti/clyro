import { useEffect, useState } from 'react'
import { AlertTriangle, BellRing, CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../../../../api'
import { cachedFetch } from '../../../../lib/apiCache'

const REFRESH_INTERVAL_MS = 60000

function stateBadge(state) {
  if (state === 'OK') return [CheckCircle2, 'text-green-400', 'OK']
  if (state === 'ALARM') return [XCircle, 'text-red-400', 'Firing']
  return [AlertTriangle, 'text-text-muted', 'No data']
}

// Real CloudWatch alarms (email-backed via the stack's SNS topic) + their
// 30-day firing history — unlike the Alerts section above it, these exist and
// notify even when nobody has this page open.
function AlarmsPanel({ projectId }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    const fetchAlarms = async () => {
      try {
        const result = await cachedFetch(`alarms:${projectId}`, REFRESH_INTERVAL_MS,
          () => api.getDeployAlarms(projectId))
        if (!cancelled) setData(result)
      } catch {
        // Transient failure — keep the last known state, retry next tick.
      }
    }
    fetchAlarms()
    const intervalId = setInterval(fetchAlarms, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [projectId])

  if (!data || data.stack_status !== 'ok') return null

  return (
    <div>
      <h3 className='text-lg font-semibold'>Alarms &amp; notifications</h3>
      {(data.warnings || []).map((warning) => (
        <p key={warning} className='mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300'>{warning}</p>
      ))}
      {data.subscription === 'pending' ? (
        <p className='mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300'>
          <BellRing className='h-4 w-4 shrink-0' />
          Alert emails are almost ready — click the confirmation link AWS sent to your inbox.
        </p>
      ) : null}
      {!data.configured ? (
        <p className='mt-3 rounded-lg border border-dashed border-border bg-surface/40 px-4 py-4 text-center text-sm text-text-muted'>
          No alarms in this stack yet — they're created the next time you provision.
        </p>
      ) : (
        <>
          <div className='mt-3 grid gap-2 md:grid-cols-2'>
            {(data.alarms || []).map((alarm) => {
              const [Icon, color, label] = stateBadge(alarm.state)
              return (
                <div key={alarm.name} title={alarm.name} className='flex items-start gap-2 rounded-lg border border-border bg-surface p-3'>
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                  <div className='min-w-0'>
                    <p className='text-sm text-text-primary'>{alarm.description || alarm.name}</p>
                    <p className={`mt-0.5 text-xs ${color}`}>{label}</p>
                  </div>
                </div>
              )
            })}
          </div>
          {(data.history || []).length > 0 ? (
            <div className='mt-3 rounded-lg border border-border bg-surface p-3'>
              <p className='text-xs font-medium text-text-muted'>Last 30 days</p>
              <div className='mt-2 space-y-1'>
                {data.history.slice(0, 8).map((item, index) => (
                  <p key={index} className='text-xs text-text-muted'>
                    <span className='text-text-primary'>{item.at ? new Date(item.at).toLocaleString() : ''}</span>
                    {' — '}{item.summary}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <p className='mt-3 text-xs text-text-muted'>Nothing has fired in the last 30 days.</p>
          )}
        </>
      )}
    </div>
  )
}

export default AlarmsPanel
