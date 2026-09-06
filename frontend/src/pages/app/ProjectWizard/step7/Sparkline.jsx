// Tiny single-series line for a stat tile — no axes or grid by design; the
// tile's label and value carry identity, the line only shows the last hour's
// shape. Needs at least two points to draw anything.
function Sparkline({ points, formatValue }) {
  if (!points || points.length < 2) return null

  const values = points.map((p) => p.v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = 100 / (points.length - 1)
  const coords = points.map((p, i) => {
    const x = (i * stepX).toFixed(2)
    // Flat series draws at the vertical center; otherwise pad 2px top/bottom.
    const y = max === min ? 14 : (26 - ((p.v - min) / span) * 24).toFixed(2)
    return [x, y]
  })
  const last = coords[coords.length - 1]
  const fmt = formatValue || ((v) => v)

  return (
    <svg
      viewBox='0 0 100 28'
      preserveAspectRatio='none'
      className='mt-2 h-7 w-full text-accent'
      role='img'
    >
      <title>{`Last hour: min ${fmt(min)}, max ${fmt(max)}`}</title>
      <polyline
        points={coords.map(([x, y]) => `${x},${y}`).join(' ')}
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinejoin='round'
        strokeLinecap='round'
        vectorEffect='non-scaling-stroke'
      />
      <circle cx={last[0]} cy={last[1]} r='2.5' fill='currentColor' />
    </svg>
  )
}

export default Sparkline
