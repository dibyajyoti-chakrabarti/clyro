import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api } from '../../../../api'

const REFRESH_INTERVAL_MS = 60000

function LogsPanel({ projectId, services }) {
  const [selected, setSelected] = useState('')
  const [level, setLevel] = useState('all')
  const [events, setEvents] = useState([])
  const [warnings, setWarnings] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (services.length === 0) return
    if (!services.includes(selected)) setSelected(services[0])
  }, [services, selected])

  const fetchLogs = useCallback(async () => {
    if (!projectId || !selected) return
    setLoading(true)
    try {
      const data = await api.getDeployLogs(projectId, { service: selected, level })
      setEvents(data.events || [])
      setWarnings(data.warnings || [])
    } catch {
      // Transient failure — keep the last known events, retry on the next refresh.
    } finally {
      setLoading(false)
    }
  }, [projectId, selected, level])

  useEffect(() => {
    fetchLogs()
    const intervalId = setInterval(fetchLogs, REFRESH_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [fetchLogs])

  if (services.length === 0) return null

  return (
    <div>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-lg font-semibold'>Logs</h3>
        <div className='flex items-center gap-2'>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className='rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text-primary'
          >
            {services.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className='flex rounded-lg border border-border bg-surface p-0.5 text-xs'>
            {[['all', 'All'], ['error', 'Errors']].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setLevel(value)}
                className={`rounded-md px-2 py-1 ${level === value ? 'bg-white/10 text-text-primary' : 'text-text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchLogs}
            className='rounded-lg border border-border bg-surface p-1.5 text-text-muted hover:text-text-primary'
            aria-label='Refresh logs'
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      {warnings.map((warning) => (
        <p key={warning} className='mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300'>{warning}</p>
      ))}
      <div className='mt-3 max-h-80 overflow-auto rounded-lg border border-border bg-surface p-3 font-mono text-xs'>
        {events.length === 0 ? (
          <p className='font-sans text-sm text-text-muted'>No log events in the last hour.</p>
        ) : (
          events.map((event, index) => (
            <p key={index} className='whitespace-pre-wrap break-all py-0.5'>
              <span className='text-text-muted'>{new Date(event.timestamp).toLocaleTimeString()}</span>{' '}
              <span className='text-text-primary'>{event.message}</span>
            </p>
          ))
        )}
      </div>
    </div>
  )
}

export default LogsPanel
