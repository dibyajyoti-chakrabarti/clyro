import { Box, Cloud, Folder, NotebookText, Rocket } from 'lucide-react'

export default function StepProgress({ steps, current, completed }) {
  const stepIcons = {
    1: Folder,
    2: NotebookText,
    3: Box,
    4: Cloud,
    5: Rocket,
  }

  const completedCount = steps.filter((step) => completed.has(step.number)).length

  return (
    <nav aria-label='Wizard progress'>
      <style>{`
        @keyframes stepProgressBlink {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
      `}</style>

      <ol className='relative'>
        <span className='pointer-events-none absolute left-[24px] top-0 bottom-0 w-[2px] -translate-x-1/2 bg-[rgba(255,255,255,0.15)]' />
        <span
          className='pointer-events-none absolute left-[24px] top-0 w-[2px] -translate-x-1/2 bg-[#E8B84B] transition-[height] duration-[400ms] ease-in-out'
          style={{ height: `${steps.length ? (completedCount / steps.length) * 100 : 0}%` }}
        />

        {steps.map((item, index) => {
          const isCompleted = completed.has(item.number)
          const isActive = current === item.number
          const isLast = index === steps.length - 1
          const Icon = stepIcons[item.number]

          return (
            <li
              key={item.number}
              className={`relative flex gap-4 ${isLast ? 'pb-0' : 'pb-7'}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span
                className={`relative z-10 grid h-[48px] w-[48px] shrink-0 place-items-center rounded-full border-[1.5px] transition-all duration-[250ms] ${
                  isCompleted
                    ? 'border-[#E8B84B] bg-[#E8B84B] text-[#111111]'
                    : isActive
                      ? 'border-[#E8B84B] bg-[#E8B84B] text-[#111111] shadow-[0_0_25px_rgba(232,184,75,0.35)] animate-[stepProgressBlink_1.6s_ease-in-out_infinite]'
                      : 'border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.03)] text-white/80'
                }`}
              >
                <Icon className={`h-5 w-5 ${isCompleted || isActive ? 'text-black' : 'text-white/80'}`} />
              </span>

              <div className='min-w-0 pt-1.5'>
                <p
                  className={`text-[18px] font-medium leading-[1.2] transition-colors ${
                    isActive || isCompleted ? 'text-white' : 'text-[rgba(255,255,255,0.85)]'
                  }`}
                >
                  {item.title}
                </p>
                {isActive ? (
                  <p className='mt-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#E8B84B]'>
                    In progress
                  </p>
                ) : isCompleted ? (
                  <p className='mt-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#E8B84B]'>
                    Done
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
