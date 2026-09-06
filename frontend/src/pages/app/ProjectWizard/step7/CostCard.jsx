import MonitorCard from './MonitorCard'
import RingGauge from './RingGauge'

// Cost figures aren't wired to a source yet — the tiles render their empty state.
const TILES = [
  ['This month so far', '-'],
  ['Projected', '-'],
  ['Last month', '-'],
]

function CostCard({ className = '' }) {
  return (
    <MonitorCard title='Cost' tint='amber' className={className}>
      {/* Equal columns + items-start so all three rings share one top edge no
          matter how many lines their caption wraps to. */}
      <div className='grid flex-1 grid-cols-3 items-start content-center gap-2'>
        {TILES.map(([label, value]) => (
          <RingGauge key={label} percent={null} label={value} caption={label} />
        ))}
      </div>
    </MonitorCard>
  )
}

export default CostCard
