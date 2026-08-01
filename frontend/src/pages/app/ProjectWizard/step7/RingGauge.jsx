// Circular ring gauge for the Uptime and Cost tiles. `percent` null renders an
// empty track with a dash, which is how "no data yet" reads in both places.
function RingGauge({ percent, label, caption }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const filled = percent == null ? 0 : Math.max(0, Math.min(100, percent))

  return (
    <div className='flex min-w-0 flex-col items-center gap-2 text-center'>
      {/* Fixed box + fixed viewBox keeps every gauge the same diameter and
          stroke weight regardless of the caption length beneath it. */}
      <div className='relative h-[68px] w-[68px] shrink-0'>
        <svg viewBox='0 0 68 68' className='h-full w-full -rotate-90'>
          <circle cx='34' cy='34' r={radius} fill='none' stroke='currentColor' strokeWidth='6' className='text-white/[0.06]' />
          {filled > 0 ? (
            <circle
              cx='34'
              cy='34'
              r={radius}
              fill='none'
              stroke='url(#ringGold)'
              strokeWidth='6'
              strokeLinecap='round'
              strokeDasharray={`${(filled / 100) * circumference} ${circumference}`}
            />
          ) : null}
          <defs>
            <linearGradient id='ringGold' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stopColor='#FFD700' />
              <stop offset='100%' stopColor='#F5A623' />
            </linearGradient>
          </defs>
        </svg>
        <span className='absolute inset-0 flex items-center justify-center text-sm font-semibold text-text-primary'>
          {label}
        </span>
      </div>
      <p className='w-full text-balance text-[10px] font-semibold uppercase leading-tight tracking-wider text-text-muted'>
        {caption}
      </p>
    </div>
  )
}

export default RingGauge
