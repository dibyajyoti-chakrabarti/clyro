import { useEffect, useState } from 'react'
import { api } from '../../../../api'
import { cachedFetch } from '../../../../lib/apiCache'

const REFRESH_INTERVAL_MS = 60000

// Real CloudWatch alarms (email-backed via the stack's SNS topic) + their
// 30-day firing history — unlike the Alerts section, these exist and notify
// even when nobody has this page open. Polled once by the Step 7 panel and
// shared with both cards that read from it, so the layout split doesn't double
// the request rate.
export default function useAlarms(projectId) {
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

  return data
}
