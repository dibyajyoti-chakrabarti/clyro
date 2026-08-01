// Decorative glowing cube that sits beside the stack facts in the Logs card
// footer — purely ornamental, hidden from assistive tech.
function GlowCube() {
  return (
    <div aria-hidden='true' className='relative hidden h-16 w-16 shrink-0 items-center justify-center sm:flex'>
      <div className='absolute inset-0 rounded-full bg-amber-400/10 blur-xl' />
      <svg viewBox='0 0 64 64' className='relative h-12 w-12 text-amber-400/70'>
        <g fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinejoin='round'>
          <path d='M32 6 56 19v26L32 58 8 45V19z' className='opacity-60' />
          <path d='M32 6 32 32 56 19' />
          <path d='M32 32 32 58 8 45' />
          <path d='M32 32 8 19' />
        </g>
        <circle cx='32' cy='32' r='3' fill='currentColor' />
      </svg>
    </div>
  )
}

function StackStatus({ stackStatus }) {
  const isSettled = stackStatus
    && stackStatus.status.endsWith('_COMPLETE')
    && !stackStatus.status.includes('ROLLBACK')
  return stackStatus ? (
    <div className='mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-transparent p-3'>
      <div className='min-w-0'>
        <p className='truncate text-sm text-text-primary'>
          Stack name: <span className='font-semibold'>{stackStatus.stackName}</span>
        </p>
        <p className='mt-1 truncate text-sm text-text-primary'>
          Status: <span className={isSettled ? 'text-green-400' : 'text-amber-300'}>{stackStatus.status}</span>
        </p>
        <p className='mt-1 text-xs text-text-muted'>Last updated: {stackStatus.lastUpdated}</p>
      </div>
      <GlowCube />
    </div>
  ) : null
}

export default StackStatus
