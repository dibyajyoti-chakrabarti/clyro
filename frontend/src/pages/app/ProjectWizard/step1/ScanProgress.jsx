import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import PremiumStepHeading from './PremiumStepHeading'

const ACTIVITIES = [
  'Analyzing requirements.txt',
  'Reading environment configuration',
  'Detecting PostgreSQL dependencies',
  'Identifying Redis integration',
  'Mapping service relationships',
  'Generating infrastructure graph',
  'Building deployment blueprint',
  'Validating architecture constraints',
  'Resolving service dependencies',
  'Inspecting Docker configuration',
  'Tracing API surface area',
  'Indexing configuration files',
]

function ScanProgress({ scanMessages, scanStep }) {
  const totalSteps = scanMessages.length
  const pct = totalSteps > 0 ? Math.round((scanStep / totalSteps) * 100) : 0

  const [displayPct, setDisplayPct] = useState(0)
  const [activityIdx, setActivityIdx] = useState(0)
  const [activityKey, setActivityKey] = useState(0)

  useEffect(() => {
    const diff = pct - displayPct
    if (diff === 0) return
    const step = diff > 0 ? 1 : -1
    const timer = setInterval(() => {
      setDisplayPct((prev) => {
        const next = prev + step
        if ((step > 0 && next >= pct) || (step < 0 && next <= pct)) {
          clearInterval(timer)
          return pct
        }
        return next
      })
    }, 18)
    return () => clearInterval(timer)
  }, [pct])

  useEffect(() => {
    const interval = setInterval(() => {
      setActivityIdx((prev) => (prev + 1) % ACTIVITIES.length)
      setActivityKey((prev) => prev + 1)
    }, 2600)
    return () => clearInterval(interval)
  }, [])

  const filesScanned = Math.floor((scanStep / totalSteps) * 312)
  const configFiles = Math.floor((scanStep / totalSteps) * 18)
  const services = Math.floor((scanStep / totalSteps) * 6)
  const draftPct = Math.round((scanStep / totalSteps) * 100)

  return (
    <>
      <style>{`
        @keyframes shimmerText {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes blinkCursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes activityIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pingRing {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        .active-shimmer {
          background: linear-gradient(90deg, #F5B942 0%, #FFD76A 40%, #F5B942 60%, #FFD76A 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmerText 2.4s linear infinite;
        }
        .cursor-blink {
          animation: blinkCursor 1s step-end infinite;
        }
        .activity-line {
          animation: activityIn 0.35s ease-out forwards;
        }
      `}</style>

      <div
        className='flex h-full w-full min-h-0 items-center justify-center'
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% 100%, rgba(245,185,66,0.04) 0%, transparent 70%)',
        }}
      >
        <div className='w-full max-w-2xl text-center'>

          {/* Heading */}
          <PremiumStepHeading prefix='Analyzing Your' highlight='Repository' />
          <p className='mt-1 text-sm italic text-white/40 tracking-wide'>
            Generating Infrastructure Blueprint
          </p>
          <p className='mx-auto mt-3 max-w-[520px] text-sm text-white/45 leading-relaxed'>
            We're inspecting your codebase, services, dependencies, and configuration to generate a
            production-ready architecture.
          </p>

          {/* Main glass card */}
          <div className='mt-6 w-full rounded-[24px] border border-[rgba(255,196,0,0.18)] bg-[rgba(10,10,10,0.82)] p-8 text-left shadow-[0_18px_44px_rgba(0,0,0,0.28),0_0_0_1px_rgba(255,196,0,0.08),0_0_18px_rgba(255,196,0,0.06)]'>

            {/* Checklist */}
            <div>
              {scanMessages.map((item, index) => {
                const isDone = index < scanStep
                const isActive = index === scanStep

                return (
                  <div key={item}>
                    <div className='flex items-center gap-4 py-2.5'>
                      {/* State indicator */}
                      {isDone ? (
                        <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/50'>
                          <Check className='h-3 w-3 text-emerald-400' strokeWidth={3} />
                        </span>
                      ) : isActive ? (
                        <span className='relative flex h-6 w-6 shrink-0 items-center justify-center'>
                          <span
                            className='absolute inset-0 rounded-full border-2 border-amber-400'
                            style={{ animation: 'pingRing 1.4s ease-out infinite' }}
                          />
                          <span className='h-2 w-2 rounded-full bg-amber-400' />
                        </span>
                      ) : (
                        <span className='h-6 w-6 shrink-0 rounded-full border border-white/15' />
                      )}

                      {/* Label */}
                      <p
                        className={[
                          'text-sm flex-1',
                          isDone
                            ? 'text-white/35'
                            : isActive
                              ? 'font-semibold'
                              : 'text-white/20',
                        ].join(' ')}
                      >
                        {isActive ? (
                          <span className='active-shimmer'>{item}</span>
                        ) : (
                          item
                        )}
                      </p>

                      {/* Running badge for active */}
                      {isActive && (
                        <span className='shrink-0 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-400/20'>
                          Running
                        </span>
                      )}

                      {/* Done badge */}
                      {isDone && (
                        <span className='shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400/70'>
                          Done
                        </span>
                      )}
                    </div>

                    {index < scanMessages.length - 1 && (
                      <div className='border-b border-white/[0.05]' />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Separator */}
            <div className='my-6 border-t border-white/[0.07]' />

            {/* Infrastructure Progress Module */}
            <div>
              {/* Header row */}
              <div className='mb-3 flex items-center justify-between'>
                <span className='text-[11px] uppercase tracking-widest text-white/40 font-medium'>
                  Infrastructure Analysis Progress
                </span>
                <span className='text-sm font-semibold tabular-nums'
                  style={{
                    background: 'linear-gradient(180deg, #FFE98A 0%, #FFC107 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {displayPct}%
                </span>
              </div>

              {/* Progress bar */}
              <div className='h-3 w-full overflow-hidden rounded-full bg-white/5 border border-white/10'>
                <div
                  className='h-full rounded-full bg-gradient-to-r from-[#F5B942] to-[#FFD76A] transition-all duration-700 ease-out'
                  style={{
                    width: `${pct}%`,
                    boxShadow: pct > 0 ? '0 0 8px rgba(245,185,66,0.45)' : 'none',
                  }}
                />
              </div>

              {/* Stats row */}
              <div className='mt-4 grid grid-cols-4 gap-3'>
                {[
                  { label: 'Files Scanned', value: filesScanned.toLocaleString() },
                  { label: 'Config Files', value: configFiles },
                  { label: 'Services', value: services },
                  { label: 'Draft', value: `${draftPct}%` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className='rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-center'
                  >
                    <div className='text-base font-semibold tabular-nums text-white/80'>{value}</div>
                    <div className='mt-0.5 text-[10px] text-white/30 leading-tight'>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Separator */}
            <div className='my-6 border-t border-white/[0.07]' />

            {/* Live Analysis Stream */}
            <div>
              <div className='mb-2.5 flex items-center gap-2'>
                <span
                  className='text-[10px] uppercase tracking-widest font-medium'
                  style={{ color: 'rgba(245,185,66,0.6)' }}
                >
                  Live Analysis
                </span>
                <span className='h-1.5 w-1.5 rounded-full bg-amber-400/60'
                  style={{ animation: 'blinkCursor 1.2s ease-in-out infinite' }}
                />
              </div>

              <div
                key={activityKey}
                className='activity-line flex items-center gap-2 font-mono text-xs text-white/40'
              >
                <span className='text-amber-400/50 select-none'>›</span>
                <span>{ACTIVITIES[activityIdx]}</span>
                <span className='cursor-blink text-amber-400/70'>|</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}

export default ScanProgress
