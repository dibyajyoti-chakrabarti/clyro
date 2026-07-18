import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../../../../api'
import HealthOverview from './HealthOverview'
import MetricsGrid from './MetricsGrid'
import AlertsList from './AlertsList'
import StackStatus from './StackStatus'

const POLL_INTERVAL_MS = 20000

function StepSevenPanel({ projectId }) {
  const [healthItems, setHealthItems] = useState([])
  const [alerts, setAlerts] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [stackStatus, setStackStatus] = useState(null)

  const statusIcon = (status) => {
    if (status === 'healthy') return [CheckCircle2, 'text-green-400', 'Healthy']
    if (status === 'degraded') return [AlertTriangle, 'text-amber-300', 'Degraded']
    return [XCircle, 'text-red-400', 'Unhealthy']
  }

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    const poll = async () => {
      try {
        const data = await api.getDeployHealth(projectId)
        if (cancelled) return
        setNotFound(data.stack_status === 'not_found')
        setHealthItems((data.health_items || []).map((item) => ({
          name: item.name,
          status: item.state === 'healthy' ? 'healthy' : 'degraded',
          detail: `${item.running}/${item.desired} tasks running`,
        })))
        setAlerts((data.alerts || []).map((alert, index) => ({
          id: index,
          plain_message: alert.message,
          severity: alert.severity,
          fired_at: alert.fired_at ? new Date(alert.fired_at).toLocaleTimeString() : '',
        })))
        setMetrics(data.metrics || null)
        setStackStatus(data.stack ? {
          stackName: data.stack.name,
          status: data.stack.status,
          lastUpdated: data.stack.last_updated ? new Date(data.stack.last_updated).toLocaleString() : '—',
        } : null)
      } catch {
        // Transient poll failure — keep the last known state, retry next tick.
      }
    }

    poll()
    const intervalId = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [projectId])

  return (
    <div className='mt-6 flex-1 overflow-auto rounded-xl border border-white/[0.07] bg-background/40 p-6'>
      <div className='mx-auto w-full max-w-5xl space-y-6'>
        <HealthOverview healthItems={healthItems} statusIcon={statusIcon} notFound={notFound} />
        <MetricsGrid metrics={metrics} />
        <div>
          <h3 className='text-lg font-semibold'>Cost</h3>
          <div className='mt-3 grid gap-3 md:grid-cols-3'>
            {[
              ['This month so far', '—'],
              ['Projected', '—'],
              ['Last month', '—'],
            ].map(([k, v]) => (
              <div key={k} className='rounded-lg border border-border bg-surface p-3'>
                <p className='text-xs text-text-muted'>{k}</p>
                <p className='mt-2 text-xl font-semibold text-text-primary'>{v}</p>
              </div>
            ))}
          </div>
        </div>
        <AlertsList alerts={alerts} />
        <StackStatus stackStatus={stackStatus} />
      </div>
    </div>
  )
}

export default StepSevenPanel
