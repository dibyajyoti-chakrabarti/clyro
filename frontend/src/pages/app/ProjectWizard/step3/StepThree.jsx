import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { api } from '../../../../api'
import { getQuestions } from '../constants/questions'
import ChoiceOption from './ChoiceOption'

function QuestionBlock({ question, value, onChange }) {
  return (
    <section className='space-y-4'>
      <div className='space-y-1'>
        <p className='text-[18px] font-semibold text-white'>{question.question}</p>
      </div>
      <div className={question.type === 'free' ? 'space-y-3' : 'space-y-3'}>
        {question.type === 'free' ? (
          <textarea
            autoFocus
            className='min-h-[108px] w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-white/72 transition-all duration-200 hover:border-[rgba(255,196,0,0.25)] focus-visible:outline-none focus-visible:border-[rgba(255,196,0,0.55)] focus-visible:ring-2 focus-visible:ring-[rgba(255,196,0,0.14)]'
            placeholder='e.g. A marketplace where photographers sell prints.'
            value={value || ''}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          question.options.map((option) => (
            <ChoiceOption
              key={option.value}
              option={option}
              selected={value === option.value}
              onClick={() => onChange(option.value)}
            />
          ))
        )}
      </div>
    </section>
  )
}

export default function StepThreePanel({ projectId, projectData, setProjectData, setStep3CanContinue, onComplete }) {
  const questions = useMemo(() => getQuestions(), [])

  // AWS connect + account type capture live in Step 2 now, ahead of this step —
  // Step 3 is intent questions only. A resumed project whose intent is already
  // saved advances straight past Step 3 rather than re-asking.
  const [answers, setAnswers] = useState(() => ({ ...(projectData.intent || {}) }))
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const visibleQuestions = questions.filter((q) => !q.condition || q.condition(answers))
  const canContinue = visibleQuestions.every((question) => {
    if (question.type === 'free') {
      return String(answers[question.id] || '').trim() !== ''
    }
    return answers[question.id] !== undefined && answers[question.id] !== ''
  })

  useEffect(() => {
    setStep3CanContinue(canContinue && !isSaving)
  }, [canContinue, isSaving, setStep3CanContinue])

  // Resume case: intent already saved from a previous visit — nothing left to
  // do in Step 3, advance straight to Step 4 instead of re-showing the form.
  useEffect(() => {
    if (projectData.intent?.description) onComplete?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleContinue = async () => {
    if (!canContinue || isSaving) return

    const payload = {
      ...projectData.intent,
      ...answers,
      compute_choice: 'ecs_fargate',
    }

    setProjectData((prev) => ({ ...prev, intent: payload }))
    setIsSaving(true)
    setSaveError('')

    try {
      await api.saveIntent(projectId, payload)
      onComplete?.()
    } catch (err) {
      setSaveError(err.message || 'Failed to save your answers')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='flex h-full min-h-0 w-full items-start justify-center'>
      <style>{`
        @keyframes step2FadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className='w-full max-w-[980px] text-center'>
        <h2 className='mt-0 text-[clamp(44px,5.6vw,64px)] font-bold leading-[1.02] tracking-[-0.05em] text-white' style={{ animation: 'step2FadeIn 320ms ease-out both' }}>
          Tell us about{' '}
          <span className='bg-[linear-gradient(90deg,#FFF1B8_0%,#FFD84D_40%,#E8B84B_70%,#B8870B_100%)] bg-clip-text text-transparent'>
            your application
          </span>
        </h2>

        <p className='mx-auto mt-5 max-w-[720px] text-[20px] leading-[1.65] text-white/72'>
          Help Clyro understand your workload so we can generate the best infrastructure recommendation.
        </p>

        <div className='mx-auto mt-10 w-full max-w-[920px] overflow-hidden rounded-[24px] border border-[rgba(255,196,0,0.18)] bg-[rgba(10,10,10,0.82)] p-10 text-left shadow-[0_18px_44px_rgba(0,0,0,0.28),0_0_0_1px_rgba(255,196,0,0.08),0_0_18px_rgba(255,196,0,0.06)]'>
          <div className='space-y-8'>
            {visibleQuestions.map((question) => (
              <QuestionBlock
                key={question.id}
                question={question}
                value={answers[question.id]}
                onChange={(value) => handleChange(question.id, value)}
              />
            ))}
          </div>

          <div className='mt-10 flex justify-end gap-3 pr-2 pb-2'>
            <Button
              variant='primary'
              onClick={handleContinue}
              disabled={!canContinue || isSaving}
              className='h-[56px] min-w-[170px] rounded-[16px] border border-[#F2D57B]/60 bg-[linear-gradient(180deg,#FFD54A,#F6B700)] px-6 text-[16px] font-semibold text-black shadow-[0_0_24px_rgba(232,184,75,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_0_30px_rgba(232,184,75,0.3)]'
            >
              {isSaving ? (
                <span className='h-4 w-4 rounded-full border-2 border-black border-t-transparent animate-spin' />
              ) : (
                <>
                  Continue
                  <ArrowRight className='h-4 w-4' />
                </>
              )}
            </Button>
          </div>

          {saveError ? <p className='mt-6 text-sm text-[#FF8F8F]'>{saveError}</p> : null}
        </div>
      </div>
    </div>
  )
}
