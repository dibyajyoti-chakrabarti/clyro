import { useEffect, useState } from 'react'
import { api } from '../../../../api'
import { cachedFetch } from '../../../../lib/apiCache'
import MonitorCard from './MonitorCard'
import RingGauge from './RingGauge'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

// Down buckets are full-height AND red so the up/down distinction never rests
// on the red/green hue alone; every bucket carries a tooltip with its half-hour
// window and state.
function stripClasses(state) {
  if (state === 'down') return 'h-8 bg-danger'
  if (state === 'up') return 'h-6 self-end bg-success/70'
  return 'h-6 self-end bg-border/60'
}

// Renders two sibling cards (uptime gauges + downtime timeline) off one fetch;
// the caller places them directly in its grid row.
function UptimeSection({ projectId, uptimeClassName = '', timelineClassName = '' }) {
  const [history, setHistory] = useState(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    const fetchHistory = async () => {
      try {
        const data = await cachedFetch(`history:${projectId}`, REFRESH_INTERVAL_MS, () => api.getDeployHistory(projectId))
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
    <>
      <MonitorCard title='Uptime' tint='amber' className={uptimeClassName}>
        <div className='grid flex-1 grid-cols-2 items-start content-center gap-3'>
          {tiles.map(([label, value]) => (
            <RingGauge
              key={label}
              percent={value ?? null}
              label={value != null ? `${value}%` : '—'}
              caption={label}
            />
          ))}
        </div>
      </MonitorCard>

      <MonitorCard title='Downtime timeline' className={timelineClassName}>
        {history?.samples > 0 ? (
          <div className='flex flex-1 flex-col justify-center'>
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
            <p className='mt-3 text-xs leading-relaxed text-text-muted'>
              Past 24 hours, oldest to newest — each bar is 30 minutes.
              <br />
              Full red bars mark downtime.
            </p>
          </div>
        ) : (
          <p className='flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-surface/40 px-4 py-4 text-center text-sm text-text-muted'>
            No history yet — uptime starts recording once the health collector has run.
          </p>
        )}
      </MonitorCard>
    </>
  )
}

export default UptimeSection
