import { Check, LoaderCircle } from 'lucide-react'
import Button from '../../../../components/ui/Button'

function ScanProgress({ scanMessages, scanStep, onContinue, canContinue = false }) {
  const total = Math.max(scanMessages.length - 1, 1)
  const progressPercent = Math.round((scanStep / total) * 100)

  return (
    <div className='flex h-full w-full min-h-0 items-center justify-center box-border'>
      <style>{`
        @keyframes scanShimmer {
          0% { transform: translateX(-35%); }
          100% { transform: translateX(135%); }
        }
      `}</style>

      <div className='w-full max-w-[760px] box-border text-center'>
        <p className='text-[11px] font-semibold uppercase tracking-[0.24em] text-[#E8B84B]'>
          STEP 1 OF 5
        </p>

        <h2 className='mt-5 text-[clamp(44px,5.8vw,64px)] font-bold leading-[1.05] tracking-[-0.04em] text-white'>
          Connecting your repository
        </h2>

        <p className='mx-auto mt-5 max-w-[700px] text-[22px] leading-[1.7] text-white/75'>
          Crylo is scanning your codebase to understand your stack, dependencies, and environment variables.
        </p>

        <div className='mx-auto mt-10 w-full max-w-[640px] rounded-[24px] border border-[rgba(255,196,0,0.20)] bg-[rgba(12,12,12,0.80)] p-10 text-left shadow-[0_16px_40px_rgba(0,0,0,0.28)]'>
          <div className='space-y-4'>
            {scanMessages.map((item, index) => {
              const isDone = index < scanStep
              const isActive = index === scanStep
              const isPending = index > scanStep

              return (
                <div key={item}>
                  <div className='flex h-[40px] items-center gap-4'>
                    {isDone ? (
                      <span className='grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#18C37E] text-black'>
                        <Check className='h-4 w-4' strokeWidth={3} />
                      </span>
                    ) : isActive ? (
                      <span className='grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#E8B84B]/15 text-[#E8B84B]'>
                        <LoaderCircle className='h-4 w-4 animate-spin' />
                      </span>
                    ) : (
                      <span className='h-6 w-6 shrink-0 rounded-full border border-white/30 bg-transparent' />
                    )}

                    <p
                      className={[
                        'text-[16px] font-medium',
                        isDone ? 'text-white' : isActive ? 'text-[#E8B84B]' : 'text-white/62',
                      ].join(' ')}
                    >
                      {item}
                    </p>
                  </div>

                  {index < scanMessages.length - 1 ? (
                    <div className='ml-3.5 h-[1px] bg-white/8' />
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className='mt-8'>
            <div className='relative h-[8px] overflow-hidden rounded-full bg-white/[0.08]'>
              <div
                className='absolute inset-y-0 left-0 w-full rounded-full bg-[linear-gradient(90deg,#FFD54A,#F6B700,#FFD54A)]'
                style={{
                  width: `${progressPercent}%`,
                  backgroundSize: '200% 100%',
                  boxShadow: '0 0 18px rgba(232,184,75,0.18)',
                }}
              >
                <span
                  className='absolute inset-0 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.28),transparent)] opacity-50'
                  style={{ animation: 'scanShimmer 1.8s linear infinite' }}
                />
              </div>
            </div>
            <p className='mt-3 text-right text-[14px] font-medium text-white/70'>{progressPercent}%</p>
          </div>
        </div>

        <div className='mt-8 flex justify-end'>
          <Button
            variant='primary'
            onClick={onContinue}
            disabled={!canContinue}
            className='h-[64px] w-[200px] rounded-[16px] border border-[#F2D57B]/60 bg-[linear-gradient(180deg,#FFD54A,#F6B700)] text-[20px] font-bold text-black shadow-[0_0_28px_rgba(232,184,75,0.22)] hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(232,184,75,0.30)]'
          >
            Continue
            <span className='text-lg leading-none'>→</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ScanProgress
