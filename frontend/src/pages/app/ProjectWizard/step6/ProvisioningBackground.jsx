import { memo } from 'react'
import waterfallLoader from '../../../../assets/steps/step6/waterfall_loader.webm'

// Decorative background video shown only behind the Step 6 provisioning
// loader. Purely visual — memoized so polling-driven re-renders of the
// provisioning screen (log/progress updates every few seconds) don't restart
// or re-mount the video.
function ProvisioningBackground() {
  return (
    <div className='pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[28px]'>
      <video
        className='absolute inset-0 h-full w-full object-cover'
        src={waterfallLoader}
        autoPlay
        muted
        loop
        playsInline
        controls={false}
        aria-hidden='true'
        tabIndex={-1}
      />
      <div className='absolute inset-0 bg-black/55' />
    </div>
  )
}

export default memo(ProvisioningBackground)
