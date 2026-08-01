import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { api } from '../../../../api'
import { cachedFetch, invalidate } from '../../../../lib/apiCache'
import GlassSelect from '../../../../components/ui/GlassSelect'
import MonitorCard from './MonitorCard'

const REFRESH_INTERVAL_MS = 60000
const CACHE_TTL_MS = 30000

// Last hour is read live from CloudWatch; longer ranges come from the S3 log
// archive, which is written in 5-minute batches.
const RANGES = [
  ['1h', 'Last hour'],
  ['6h', 'Last 6 hours'],
  ['24h', 'Last 24 hours'],
  ['7d', 'Last 7 days'],
]

// Wrap each case-insensitive match of the active search term in a <mark> so
// the hit is visible inside long log lines.
function highlight(message, query) {
  if (!query) return message
  const lower = message.toLowerCase()
  const needle = query.toLowerCase()
  const parts = []
  let i = 0
  for (;;) {
    const at = lower.indexOf(needle, i)
    if (at === -1) {
      parts.push(message.slice(i))
      break
    }
    parts.push(message.slice(i, at))
    parts.push(
      <mark key={at} className='rounded-sm bg-accent/30 text-inherit'>
        {message.slice(at, at + needle.length)}
      </mark>,
    )
    i = at + needle.length
  }
  return parts
}

function LogsPanel({ projectId, services, className = '', footer = null }) {
  const [selected, setSelected] = useState('')
  const [level, setLevel] = useState('all')
  const [range, setRange] = useState('1h')
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [events, setEvents] = useState([])
  const [warnings, setWarnings] = useState([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (services.length === 0) return
    if (!services.includes(selected)) setSelected(services[0])
  }, [services, selected])

  const fetchLogs = useCallback(async (force = false) => {
    if (!projectId || !selected) return
    const cacheKey = `logs:${projectId}:${selected}:${level}:${range}:${query}`
    if (force) invalidate(cacheKey)
    setLoading(true)
    try {
      const data = await cachedFetch(cacheKey, CACHE_TTL_MS,
        () => api.getDeployLogs(projectId, { service: selected, level, range, q: query || undefined }))
      setEvents(data.events || [])
      setWarnings(data.warnings || [])
      setTruncated(Boolean(data.truncated))
    } catch {
      // Transient failure — keep the last known events, retry on the next refresh.
    } finally {
      setLoading(false)
    }
  }, [projectId, selected, level, range, query])

  useEffect(() => {
    fetchLogs()
    const intervalId = setInterval(fetchLogs, REFRESH_INTERVAL_MS)
    return () => clearInterval(intervalId)
  }, [fetchLogs])

  const downloadLogs = async () => {
    if (!projectId || !selected || downloading) return
    setDownloading(true)
    try {
      const blob = await api.downloadDeployLogs(projectId,
        { service: selected, level, range, q: query || undefined })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${selected}-${range}-logs.txt`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch {
      // Keep the panel usable — the user can simply retry the download.
    } finally {
      setDownloading(false)
    }
  }

  if (services.length === 0) {
    return (
      <MonitorCard title='Logs' className={className}>
        <p className='rounded-lg border border-dashed border-border bg-surface/40 px-4 py-6 text-center text-sm text-text-muted'>
          Waiting for services to report before logs can be streamed…
        </p>
        {footer}
      </MonitorCard>
    )
  }

  return (
    <MonitorCard title='Logs' className={className}>
      <div className='flex flex-1 flex-col'>
        <div className='flex flex-wrap items-center gap-2'>
          <input
            type='search'
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery(queryInput.trim())
            }}
            placeholder='Search logs… (Enter)'
            aria-label='Search logs'
            className='min-w-0 flex-1 basis-40 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text-primary placeholder:text-text-muted'
          />
          <GlassSelect
            size='sm'
            ariaLabel='Log service'
            value={selected}
            onChange={setSelected}
            options={services.map((name) => ({ value: name, label: name }))}
            style={{ minWidth: '9rem' }}
          />
          <GlassSelect
            size='sm'
            ariaLabel='Log time range'
            value={range}
            onChange={setRange}
            options={RANGES.map(([value, label]) => ({ value, label }))}
            style={{ minWidth: '8rem' }}
          />
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
            onClick={() => fetchLogs(true)}
            className='rounded-lg border border-border bg-surface p-1.5 text-text-muted hover:text-text-primary'
            aria-label='Refresh logs'
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={downloadLogs}
            disabled={downloading}
            className='rounded-lg border border-border bg-surface p-1.5 text-text-muted hover:text-text-primary disabled:opacity-50'
            aria-label='Download logs'
          >
            <Download className='h-4 w-4' />
          </button>
        </div>
        {warnings.map((warning) => (
          <p key={warning} className='mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300'>{warning}</p>
        ))}
        <div className='mt-3 max-h-72 min-h-[7rem] flex-1 overflow-auto rounded-lg border border-white/[0.07] bg-gradient-to-br from-white/[0.03] to-transparent p-3 font-mono text-xs'>
          {events.length === 0 ? (
            <p className='font-sans text-sm text-text-muted'>
              {query ? `No matches for “${query}” in the selected range.` : 'No log events in the selected range.'}
            </p>
          ) : (
            events.map((event, index) => (
              <p key={index} className='whitespace-pre-wrap break-all py-0.5'>
                <span className='text-text-muted'>
                  {range === '1h'
                    ? new Date(event.timestamp).toLocaleTimeString()
                    : new Date(event.timestamp).toLocaleString()}
                </span>{' '}
                <span className='text-text-primary'>{highlight(event.message, query)}</span>
              </p>
            ))
          )}
        </div>
        {truncated ? (
          <p className='mt-2 text-xs text-text-muted'>Showing the most recent events — older entries in this range were left out.</p>
        ) : null}
        {footer}
      </div>
    </MonitorCard>
  )
}

export default LogsPanel
