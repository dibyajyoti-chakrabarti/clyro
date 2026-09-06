import { Activity } from 'lucide-react'
import MonitorCard from './MonitorCard'

// Pulsing ring around the state icon — decorative motion that reinforces the
// status colour the icon and label already carry.
function PulseRing({ color }) {
  return (
    <span className='relative flex h-11 w-11 shrink-0 items-center justify-center'>
      <span className={`absolute inset-0 animate-ping rounded-full opacity-20 ${color.ring}`} />
      <span className={`absolute inset-0 rounded-full ring-1 ring-inset ${color.border} ${color.bg}`} />
      <Activity className={`relative h-5 w-5 ${color.text}`} />
    </span>
  )
}

const RING_COLORS = {
  'text-green-400': { ring: 'bg-green-400', bg: 'bg-green-500/10', border: 'ring-green-500/30', text: 'text-green-400' },
  'text-amber-300': { ring: 'bg-amber-300', bg: 'bg-amber-500/10', border: 'ring-amber-500/30', text: 'text-amber-300' },
  'text-red-400': { ring: 'bg-red-400', bg: 'bg-red-500/10', border: 'ring-red-500/30', text: 'text-red-400' },
}

function HealthOverview({ healthItems, statusIcon, notFound, className = '' }) {
  return (
    <MonitorCard title='Health overview' tint='green' className={className}>
      {notFound ? (
        <p className='rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-300'>
          This project's AWS infrastructure could not be found. It may have been deleted outside Clyro.
        </p>
      ) : healthItems.length === 0 ? (
        <p className='rounded-lg border border-dashed border-border bg-surface/40 px-4 py-6 text-center text-sm text-text-muted'>
          Waiting for the first health check to report…
        </p>
      ) : (
        <div className='grid gap-3 sm:grid-cols-2'>
          {healthItems.map(({ name, status, detail }) => {
            const [, color, label] = statusIcon(status)
            return (
              <div
                key={name}
                className='flex items-center gap-3 rounded-lg border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-transparent p-3'
              >
                <PulseRing color={RING_COLORS[color] || RING_COLORS['text-amber-300']} />
                <div className='min-w-0'>
                  <p className='truncate text-sm font-semibold text-text-primary'>{name}</p>
                  <p className={`mt-0.5 text-sm ${color}`}>{label}</p>
                  <p className='mt-0.5 text-xs text-text-muted'>{detail}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </MonitorCard>
  )
}

export default HealthOverview
