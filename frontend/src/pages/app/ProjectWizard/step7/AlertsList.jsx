import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import MonitorCard from './MonitorCard'

function stateBadge(state) {
  if (state === 'OK') return [CheckCircle2, 'text-green-400', 'OK']
  if (state === 'ALARM') return [XCircle, 'text-red-400', 'Firing']
  return [AlertTriangle, 'text-text-muted', 'No data']
}

function AlertsList({ alerts, alarms = [], className = '' }) {
  const count = alerts.length > 0
    ? <span className='rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300'>{alerts.length}</span>
    : null

  return (
    <MonitorCard title='Alerts' tint='green' className={className} headerRight={count}>
      <div className='space-y-2'>
        {alerts.length === 0 ? (
          <p className='flex items-center gap-2 rounded-lg border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-transparent px-3 py-3 text-sm text-text-muted'>
            <CheckCircle2 className='h-4 w-4 shrink-0 text-success' />
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

      {/* The stack's standing alarm rules and their current state. */}
      {alarms.length > 0 ? (
        <div className='mt-3 grid gap-2 sm:grid-cols-2'>
          {alarms.map((alarm) => {
            const [Icon, color, label] = stateBadge(alarm.state)
            return (
              <div
                key={alarm.name}
                title={alarm.name}
                className='flex items-start gap-2 rounded-lg border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-transparent p-3'
              >
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                <div className='min-w-0'>
                  <p className='text-xs leading-relaxed text-text-primary'>{alarm.description || alarm.name}</p>
                  <p className={`mt-0.5 text-xs font-medium ${color}`}>{label}</p>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </MonitorCard>
  )
}

export default AlertsList
