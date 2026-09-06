import MonitorCard from './MonitorCard'
import Sparkline from './Sparkline'

function MetricsGrid({ metrics, series, className = '' }) {
  const rows = [
    ['API response time', metrics?.response_time_ms != null ? `${metrics.response_time_ms} ms` : '-',
      series?.response_time_ms, (v) => `${v} ms`],
    ['Request rate', metrics?.request_rate != null ? `${metrics.request_rate}/min` : '-',
      series?.request_rate, (v) => `${v}/min`],
    ['Error rate', metrics?.error_rate != null ? `${metrics.error_rate}%` : '-',
      series?.error_rate, (v) => `${v}%`],
    ['Backend CPU', metrics?.cpu_percent != null ? `${metrics.cpu_percent}%` : '-',
      series?.cpu_percent, (v) => `${v}%`],
  ]

  return (
    <MonitorCard title='Key metrics' tint='amber' className={className}>
      <div className='grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {rows.map(([title, primary, points, formatValue]) => (
          <div
            key={title}
            className='flex flex-col rounded-lg border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-transparent p-3'
          >
            <p className='text-[10px] font-semibold uppercase tracking-wider text-text-muted'>{title}</p>
            <p className='mt-2 text-2xl font-semibold text-text-primary'>{primary}</p>
            <Sparkline points={points} formatValue={formatValue} />
          </div>
        ))}
      </div>
    </MonitorCard>
  )
}

export default MetricsGrid
