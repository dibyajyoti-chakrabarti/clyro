import { useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import HealthOverview from './HealthOverview'
import MetricsGrid from './MetricsGrid'
import AlertsList from './AlertsList'
import StackStatus from './StackStatus'

function StepFivePanel() {
  const [healthItems, setHealthItems] = useState([]) // TODO: poll GET /api/deployments/{id}/health/
  const [alerts, setAlerts] = useState([]) // TODO: poll GET /api/deployments/{id}/alerts/
  const [stackStatus, setStackStatus] = useState(null) // TODO: fetch from GET /api/deployments/{id}/stack-status/

  const statusIcon = (status) => {
    if (status === 'healthy') return [CheckCircle2, 'text-green-400', 'Healthy']
    if (status === 'degraded') return [AlertTriangle, 'text-amber-300', 'Degraded']
    return [XCircle, 'text-red-400', 'Unhealthy']
  }

  return (
    <div className='mt-6 flex-1 overflow-auto rounded-xl border border-white/[0.07] bg-background/40 p-6'>
      <div className='mx-auto w-full max-w-5xl space-y-6'>
        <HealthOverview healthItems={healthItems} statusIcon={statusIcon} />
        <MetricsGrid />
        <div>
          <h3 className='text-lg font-semibold'>Cost</h3>
          <div className='mt-3 grid gap-3 md:grid-cols-3'>
            {[
              ['This month so far', 'â€”'],
              ['Projected', 'â€”'],
              ['Last month', 'â€”'],
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

export default StepFivePanel
