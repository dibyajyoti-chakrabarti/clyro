function MetricsGrid({ metrics }) {
  const rows = [
    ['API response time', metrics?.response_time_ms != null ? `${metrics.response_time_ms} ms` : '—'],
    ['Request rate', metrics?.request_rate != null ? `${metrics.request_rate}/min` : '—'],
    ['Error rate', metrics?.error_rate != null ? `${metrics.error_rate}%` : '—'],
    ['Backend CPU', metrics?.cpu_percent != null ? `${metrics.cpu_percent}%` : '—'],
  ]

  return (
    <div>
      <h3 className='text-lg font-semibold'>Key metrics</h3>
      <div className='mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4'>
        {rows.map(([title, primary]) => (
          <div key={title} className='rounded-lg border border-border bg-surface p-3'>
            <p className='text-xs text-text-muted'>{title}</p>
            <p className='mt-2 text-2xl font-semibold'>{primary}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MetricsGrid
