import { useEffect, useState } from 'react'
import { api } from '../../../../api'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

// Down buckets are full-height AND red so the up/down distinction never rests
// on the red/green hue alone; every bucket carries a tooltip with its half-hour
// window and state.
function stripClasses(state) {
  if (state === 'down') return 'h-8 bg-danger'
  if (state === 'up') return 'h-6 self-end bg-success/70'
  return 'h-6 self-end bg-border/60'
}

function UptimeSection({ projectId }) {
  const [history, setHistory] = useState(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    const fetchHistory = async () => {
      try {
        const data = await api.getDeployHistory(projectId)
        if (!cancelled) setHistory(data)
      } catch {
        // Transient failure — keep the last known history, retry next tick.
      }
    }
    fetchHistory()
    const intervalId = setInterval(fetchHistory, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [projectId])

  const tiles = [
    ['Last 24 hours', history?.uptime_24h],
    ['Last 7 days', history?.uptime_7d],
  ]

  return (
    <div>
      <h3 className='text-lg font-semibold'>Uptime</h3>
      <div className='mt-3 grid gap-3 md:grid-cols-2'>
        {tiles.map(([label, value]) => (
          <div key={label} className='rounded-lg border border-border bg-surface p-3'>
            <p className='text-xs text-text-muted'>{label}</p>
            <p className='mt-2 text-2xl font-semibold'>{value != null ? `${value}%` : '—'}</p>
          </div>
        ))}
      </div>
      {history?.samples > 0 ? (
        <div className='mt-3 rounded-lg border border-border bg-surface p-3'>
          <div className='flex h-8 items-stretch gap-0.5'>
            {(history.strip || []).map((bucket) => (
              <div
                key={bucket.t}
                className={`min-w-0 flex-1 rounded-sm ${stripClasses(bucket.state)}`}
                title={`${new Date(bucket.t).toLocaleString()} — ${
                  bucket.state === 'down' ? 'downtime detected' : bucket.state === 'up' ? 'healthy' : 'no data'
                }`}
              />
            ))}
          </div>
          <p className='mt-2 text-xs text-text-muted'>Past 24 hours, oldest to newest — each bar is 30 minutes. Full red bars mark downtime.</p>
        </div>
      ) : (
        <p className='mt-3 rounded-lg border border-dashed border-border bg-surface/40 px-4 py-4 text-center text-sm text-text-muted'>
          No history yet — uptime starts recording once the health collector has run.
        </p>
      )}
    </div>
  )
}

export default UptimeSection
