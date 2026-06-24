import { AlertTriangle, Check } from 'lucide-react'

function IntentSummary({ summaryQuestions, answers, formatAnswer, isSaving, saveError }) {
  return (
    <div className='mt-4 rounded-xl border border-white/[0.07] bg-surface p-5 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/[0.04]'>
      <div className='flex items-center gap-2'>
        {isSaving ? (
          <div className='h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent' />
        ) : (
          <span className='grid h-6 w-6 place-items-center rounded-full bg-success/15 text-success'>
            <Check className='h-3.5 w-3.5' strokeWidth={3} />
          </span>
        )}
        <h3 className='text-xl font-semibold tracking-tight'>{isSaving ? 'Saving your answersâ€¦' : 'All set'}</h3>
      </div>
      <div className='mt-4 overflow-hidden rounded-md border border-border'>
        <table className='w-full text-left text-sm'>
          <tbody>
            {summaryQuestions.map((question) => (
              <tr key={question.id} className='border-t border-border first:border-t-0'>
                <td className='px-3 py-2 font-medium text-text-muted'>{question.question}</td>
                <td className='px-3 py-2 text-text-primary'>{formatAnswer(question.id, answers[question.id])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {saveError ? (
        <p className='mt-3 flex items-center gap-1.5 text-xs text-danger'>
          <AlertTriangle className='h-3.5 w-3.5' />
          {saveError}
        </p>
      ) : !isSaving ? (
        <p className='mt-4 flex items-center gap-1.5 text-xs font-normal text-text-muted'>
          <Check className='h-3.5 w-3.5 text-success' />
          Intent saved â€” your architecture is ready to review
        </p>
      ) : null}
    </div>
  )
}

export default IntentSummary
