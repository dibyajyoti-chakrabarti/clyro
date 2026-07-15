import { ArrowLeft } from 'lucide-react'

function QuestionCard({
  activeQuestion,
  questionNumber,
  totalVisible,
  progressPercent,
  isComplete,
  currentVisiblePosition,
  handleBack,
  cardClass,
  children,
}) {
  return (
    <div className='mx-auto max-w-md'>
      {activeQuestion?.momentLabel && (
        <div className='mb-1 text-[11px] font-semibold uppercase tracking-widest text-accent/70'>
          {activeQuestion.momentLabel}
        </div>
      )}
      <div className='text-xs font-normal text-text-muted'>Question {Math.max(1, questionNumber)} of {Math.max(1, totalVisible)}</div>
      <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-background'>
        <div
          className='h-full rounded-full bg-gradient-to-r from-accent/80 to-accent transition-all duration-500 ease-out'
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {!isComplete && currentVisiblePosition > 0 ? (
        <button
          type='button'
          className='mt-4 inline-flex items-center gap-1 text-xs font-normal text-text-muted transition-colors hover:text-text-primary'
          onClick={handleBack}
        >
          <ArrowLeft className='h-3.5 w-3.5' />
          Back
        </button>
      ) : null}

      <div className='mt-4 overflow-hidden rounded-xl border border-white/[0.07] bg-surface shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04]'>
        <div className={`p-5 transition-all duration-[120ms] ${cardClass()}`}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default QuestionCard
