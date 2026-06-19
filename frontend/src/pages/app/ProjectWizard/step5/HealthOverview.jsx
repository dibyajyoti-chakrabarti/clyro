function HealthOverview({ healthItems, statusIcon }) {
  return (
    <div>
      <h3 className='text-lg font-semibold'>Health overview</h3>
      {healthItems.length === 0 ? (
        <p className='mt-3 rounded-lg border border-dashed border-border bg-surface/40 px-4 py-6 text-center text-sm text-text-muted'>
          Waiting for the first health check to reportâ€¦
        </p>
      ) : (
        <div className='mt-3 grid gap-3 md:grid-cols-3'>
          {healthItems.map(({ name, status, detail }) => {
            const [Icon, color, label] = statusIcon(status)
            return (
              <div key={name} className='rounded-lg border border-border bg-surface p-3'>
                <p className='text-sm font-semibold text-text-primary'>{name}</p>
                <div className={`mt-2 flex items-center gap-1 text-sm ${color}`}>
                  <Icon className='h-4 w-4' />
                  <span>{label}</span>
                </div>
                <p className='mt-1 text-xs text-text-muted'>{detail}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default HealthOverview
