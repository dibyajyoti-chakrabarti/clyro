import { Check } from 'lucide-react'

// Vertical step rail for the Project Wizard (desktop sidebar).
//
//  - A continuous track runs through the step markers; the portion behind
//    completed steps is filled with accent, so progress reads at a glance
//    (visibility of system status).
//  - Completed steps show a check; the active step gets an accent ring and
//    reveals its subtitle (progressive disclosure — only the step you're on
//    explains itself, keeping the rail uncluttered).
//  - Upcoming steps are muted, so "what remains" is always visible
//    (recognition over recall).
export default function StepProgress({ steps, current, completed }) {
  return (
    <nav aria-label='Wizard progress'>
      <ol className='relative'>
        {steps.map((item, index) => {
          const isCompleted = completed.has(item.number)
          const isActive = current === item.number
          const isLast = index === steps.length - 1
          // The segment below a marker is "filled" once this step is done.
          const segmentFilled = isCompleted

          const marker = isCompleted
            ? 'border-accent bg-accent text-background'
            : isActive
              ? 'border-accent bg-surface text-text-primary shadow-[0_0_0_4px_rgba(249,115,22,0.15)]'
              : 'border-border bg-background text-text-muted'

          return (
            <li key={item.number} className='relative flex gap-4 pb-7 last:pb-0' aria-current={isActive ? 'step' : undefined}>
              {!isLast ? (
                <span className='absolute left-4 top-8 h-[calc(100%-2rem)] w-px -translate-x-1/2 bg-border'>
                  <span
                    className={`block w-full rounded-full bg-accent transition-all duration-500 ${segmentFilled ? 'h-full' : 'h-0'}`}
                  />
                </span>
              ) : null}

              <span
                className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-semibold transition-all duration-300 ${marker}`}
              >
                {isCompleted ? <Check className='h-4 w-4' strokeWidth={3} /> : item.number}
              </span>

              <div className='min-w-0 pt-1.5'>
                <p
                  className={`text-sm leading-tight transition-colors ${
                    isActive ? 'font-semibold text-text-primary' : isCompleted ? 'font-medium text-text-primary' : 'font-medium text-text-muted'
                  }`}
                >
                  {item.title}
                </p>
                {isActive ? (
                  <p className='mt-1 text-[11px] font-medium uppercase tracking-wide text-accent'>In progress</p>
                ) : isCompleted ? (
                  <p className='mt-1 text-[11px] font-medium text-text-muted'>Done</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
