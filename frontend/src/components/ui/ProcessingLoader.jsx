import { useEffect, useRef, useState } from 'react'
import { Check, ClipboardList, Cog, Settings2, Terminal as TerminalIcon } from 'lucide-react'

// Purely visual — driven entirely by props. `steps` is the real generation
// stage list (label/done), `currentTask` is whatever status text the backend
// is currently reporting, and `justCompletedIndex` is the index of the step
// that just flipped to done (used only to replay the travel animation).
export default function ProcessingLoader({ steps = [], currentTask = '', justCompletedIndex = null, fullScreen = true }) {
  const [travelKey, setTravelKey] = useState(0)
  const prevIndexRef = useRef(null)

  useEffect(() => {
    if (justCompletedIndex != null && justCompletedIndex !== prevIndexRef.current) {
      prevIndexRef.current = justCompletedIndex
      setTravelKey((k) => k + 1)
    }
  }, [justCompletedIndex])

  const allDone = steps.length > 0 && steps.every((s) => s.done)
  const activeIndex = steps.findIndex((s) => !s.done)

  return (
    <div className={fullScreen ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm' : 'relative flex w-full flex-1 items-center justify-center p-6'}>
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[24px] border border-[rgba(255,196,0,0.18)] bg-[rgba(10,10,10,0.82)] p-8 shadow-[0_18px_44px_rgba(0,0,0,0.28),0_0_0_1px_rgba(255,196,0,0.08),0_0_18px_rgba(255,196,0,0.06)]">

        {/* Background decorations — slow-spinning gears + soft glow, purely ambient */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[rgba(255,196,0,0.08)] blur-3xl" />
          <div className="absolute -bottom-12 -right-8 h-48 w-48 rounded-full bg-[rgba(255,196,0,0.06)] blur-3xl" />
          <Settings2 className="absolute -right-6 -top-6 h-24 w-24 text-[rgba(255,196,0,0.05)] [animation:plSpin_9s_linear_infinite]" />
          <Cog className="absolute -bottom-8 -left-8 h-28 w-28 text-[rgba(255,196,0,0.045)] [animation:plSpinReverse_12s_linear_infinite]" />
        </div>

        <div className="relative flex flex-col items-stretch gap-6 md:flex-row md:items-center">

          {/* Left: checklist */}
          <div className="w-full flex-1 rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#E8B84B]" />
              <p className="text-sm font-semibold text-white">Build steps</p>
            </div>
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ease-out ${
                      step.done
                        ? 'scale-100 border-[#E8B84B] bg-[#E8B84B] text-black'
                        : 'scale-90 border-white/15 bg-white/[0.03] text-transparent'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                  <span
                    className={`text-sm transition-colors duration-300 ${
                      step.done ? 'text-white/90' : i === activeIndex ? 'text-[#E8B84B]' : 'text-white/35'
                    }`}
                  >
                    {step.label}
                  </span>
                  {i === activeIndex && !step.done ? (
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#E8B84B]" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Connector — travelling particle plays whenever justCompletedIndex changes */}
          <div className="relative hidden h-px w-14 shrink-0 md:block">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-[rgba(255,196,0,0.25)]" />
            {justCompletedIndex != null ? (
              <span
                key={travelKey}
                className="absolute top-1/2 right-0 h-2 w-2 -translate-y-1/2 rounded-full bg-[#E8B84B] shadow-[0_0_8px_2px_rgba(232,184,75,0.55)] [animation:plTravel_700ms_ease-out]"
              />
            ) : null}
          </div>

          {/* Right: terminal */}
          <div className="w-full flex-1 overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#0B0B0B] font-mono shadow-inner">
            <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
              <span className="ml-2 flex items-center gap-1.5 text-xs text-white/40">
                <TerminalIcon className="h-3 w-3" />
                clyro-agent
              </span>
            </div>
            <div className="flex min-h-[76px] items-center p-4">
              {allDone ? (
                <p className="flex items-center gap-2 text-sm text-[#7CFFB1]">
                  <Check className="h-4 w-4" strokeWidth={3} />
                  All tasks complete
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-white/80">
                  <span className="text-[#E8B84B]">$</span>
                  <span key={currentTask} className="[animation:plTermIn_240ms_ease-out]">
                    {currentTask}
                  </span>
                  <span className="inline-block h-4 w-[7px] animate-pulse bg-[#E8B84B]" />
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes plSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes plSpinReverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes plTravel {
          from { right: 0%; opacity: 0; }
          15% { opacity: 1; }
          to { right: 100%; opacity: 0; }
        }
        @keyframes plTermIn {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
