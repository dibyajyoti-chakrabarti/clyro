import Sparkline from './Sparkline'

function MetricsGrid({ metrics, series }) {
  const rows = [
    ['API response time', metrics?.response_time_ms != null ? `${metrics.response_time_ms} ms` : '—',
      series?.response_time_ms, (v) => `${v} ms`],
    ['Request rate', metrics?.request_rate != null ? `${metrics.request_rate}/min` : '—',
      series?.request_rate, (v) => `${v}/min`],
    ['Error rate', metrics?.error_rate != null ? `${metrics.error_rate}%` : '—',
      series?.error_rate, (v) => `${v}%`],
    ['Backend CPU', metrics?.cpu_percent != null ? `${metrics.cpu_percent}%` : '—',
      series?.cpu_percent, (v) => `${v}%`],
  ]

  return (
    <div>
      <h3 className='text-lg font-semibold'>Key metrics</h3>
      <div className='mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4'>
        {rows.map(([title, primary, points, formatValue]) => (
          <div key={title} className='rounded-lg border border-border bg-surface p-3'>
            <p className='text-xs text-text-muted'>{title}</p>
            <p className='mt-2 text-2xl font-semibold'>{primary}</p>
            <Sparkline points={points} formatValue={formatValue} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default MetricsGrid
