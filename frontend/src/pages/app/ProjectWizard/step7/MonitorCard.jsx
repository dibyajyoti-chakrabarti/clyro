// Shared surface for every Step 7 dashboard card: the app's standard dark card
// plus a very faint diagonal gradient (so it doesn't read as flat) and the same
// golden hover glow used on the Step 6 success cards.
const BASE =
  'relative flex flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-surface bg-gradient-to-br from-white/[0.05] via-transparent to-black/20 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04] transition-[box-shadow,border-color] duration-200 ease-out hover:border-amber-400/25 hover:shadow-[0_0_12px_rgba(245,166,35,0.25)]'

// Accent wash behind the header. Kept at 5-8% so it tints the surface without
// tinting the text sitting on top of it.
const TINTS = {
  neutral: '',
  amber: 'bg-gradient-to-b from-amber-500/[0.07] via-amber-500/[0.02] to-transparent',
  green: 'bg-gradient-to-b from-green-500/[0.06] via-green-500/[0.02] to-transparent',
}

export function CardTitle({ children }) {
  return <h3 className='text-xs font-bold uppercase tracking-[0.12em] text-text-muted'>{children}</h3>
}

function MonitorCard({ title, tint = 'neutral', className = '', headerRight, children }) {
  return (
    <section className={`${BASE} ${className}`.trim()}>
      {TINTS[tint] ? (
        <div aria-hidden='true' className={`pointer-events-none absolute inset-x-0 top-0 h-28 ${TINTS[tint]}`} />
      ) : null}
      <div className='relative flex flex-1 flex-col p-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle>{title}</CardTitle>
          {headerRight}
        </div>
        <div className='mt-4 flex flex-1 flex-col'>{children}</div>
      </div>
    </section>
  )
}

export default MonitorCard
