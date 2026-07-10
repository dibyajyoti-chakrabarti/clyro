function MetricsGrid() {
  return (
    <div>
      <h3 className='text-lg font-semibold'>Key metrics</h3>
      <div className='mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4'>
        {[
          ['API response time', '—', ''],
          ['Request rate', '—', ''],
          ['Error rate', '—', ''],
          ['Backend CPU', '—', ''],
        ].map(([title, primary, secondary]) => (
          <div key={title} className='rounded-lg border border-border bg-surface p-3'>
            <p className='text-xs text-text-muted'>{title}</p>
            <p className='mt-2 text-2xl font-semibold'>{primary}</p>
            {secondary ? <p className='mt-1 text-xs text-text-muted'>{secondary}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export default MetricsGrid
