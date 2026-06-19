function StackStatus({ stackStatus }) {
  return stackStatus ? (
    <div className='rounded-lg border border-border bg-surface p-3'>
      <p className='text-sm text-text-primary'>
        Stack name: <span className='font-semibold'>{stackStatus.stackName}</span>
      </p>
      <p className='mt-1 text-sm text-text-primary'>
        Status: <span className='text-green-400'>{stackStatus.status}</span>
      </p>
      <p className='mt-1 text-xs text-text-muted'>Last updated: {stackStatus.lastUpdated}</p>
    </div>
  ) : null
}

export default StackStatus
