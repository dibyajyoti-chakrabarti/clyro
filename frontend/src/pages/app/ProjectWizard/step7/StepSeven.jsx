import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react'
import { api } from '../../../../api'
import { cachedFetch } from '../../../../lib/apiCache'
import AlarmsPanel from './AlarmsPanel'
import HealthOverview from './HealthOverview'
import MetricsGrid from './MetricsGrid'
import AlertsList from './AlertsList'
import CostCard from './CostCard'
import LogsPanel from './LogsPanel'
import StackStatus from './StackStatus'
import UptimeSection from './UptimeSection'
import useAlarms from './useAlarms'

const POLL_INTERVAL_MS = 20000

function StepSevenPanel({ projectId }) {
  const [healthItems, setHealthItems] = useState([])
  const [alerts, setAlerts] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [series, setSeries] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [stackStatus, setStackStatus] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [warningsDismissed, setWarningsDismissed] = useState(false)

  // Polled once here and split across two cards: the rules render in Alerts,
  // the notification state and history in Alarms & notifications.
  const alarmsData = useAlarms(projectId)
  const alarmRules = alarmsData?.stack_status === 'ok' && alarmsData.configured ? (alarmsData.alarms || []) : []

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
        // 15s TTL matches the server-side snapshot cache — a remount within
        // that window (navigating away and back) renders without a round trip.
        const data = await cachedFetch(`health:${projectId}`, 15_000, () => api.getDeployHealth(projectId))
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
        setSeries(data.series || null)
        setStackStatus(data.stack ? {
          stackName: data.stack.name,
          status: data.stack.status,
          lastUpdated: data.stack.last_updated ? new Date(data.stack.last_updated).toLocaleString() : '-',
        } : null)
        setWarnings(data.warnings || [])
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
    <div className='mt-6 flex-1 overflow-auto'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-4'>
        {warnings.length > 0 && !warningsDismissed ? (
          <div className='flex items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2'>
            <div className='space-y-1'>
              {warnings.map((warning) => (
                <p key={warning} className='text-xs text-amber-300'>{warning}</p>
              ))}
            </div>
            <button
              onClick={() => setWarningsDismissed(true)}
              className='text-amber-300/70 hover:text-amber-300'
              aria-label='Dismiss warnings'
            >
              <X className='h-4 w-4' />
            </button>
          </div>
        ) : null}
        {/* Row 1 — health (5/12) + key metrics (7/12) */}
        <div className='grid gap-4 lg:grid-cols-12'>
          <HealthOverview
            healthItems={healthItems}
            statusIcon={statusIcon}
            notFound={notFound}
            className='lg:col-span-5'
          />
          <MetricsGrid metrics={metrics} series={series} className='lg:col-span-7' />
        </div>

        {/* Row 2 — uptime + downtime timeline (wider) + cost */}
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-12'>
          <UptimeSection
            projectId={projectId}
            uptimeClassName='lg:col-span-3'
            timelineClassName='lg:col-span-6'
          />
          <CostCard className='md:col-span-2 lg:col-span-3' />
        </div>

        {/* Row 3 — alerts + alarms + logs */}
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          <AlertsList alerts={alerts} alarms={alarmRules} />
          <AlarmsPanel data={alarmsData} />
          <LogsPanel
            projectId={projectId}
            services={healthItems.map((item) => item.name)}
            className='md:col-span-2 xl:col-span-1'
            footer={<StackStatus stackStatus={stackStatus} />}
          />
        </div>
      </div>
    </div>
  )
}

export default StepSevenPanel
