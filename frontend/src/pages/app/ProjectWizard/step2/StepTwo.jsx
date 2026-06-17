import { ArrowRight } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import QuestionCard from './QuestionCard'
import ChoiceOption from './ChoiceOption'
import IntentSummary from './IntentSummary'
import useQuestionFlow from '../hooks/useQuestionFlow'

function StepTwoPanel({ projectId, projectData, setProjectData, setStep2CanContinue }) {
  const {
    activeQuestion,
    questionNumber,
    totalVisible,
    progressPercent,
    isComplete,
    currentVisiblePosition,
    handleBack,
    cardClass,
    summaryQuestions,
    answers,
    formatAnswer,
    isSaving,
    saveError,
    descriptionValue,
    domainValue,
    setDescriptionValue,
    setDomainValue,
    handleChoice,
    handleFreeNext,
  } = useQuestionFlow({ projectId, projectData, setProjectData, setStep2CanContinue })

  return (
    <QuestionCard
      activeQuestion={activeQuestion}
      questionNumber={questionNumber}
      totalVisible={totalVisible}
      progressPercent={progressPercent}
      isComplete={isComplete}
      currentVisiblePosition={currentVisiblePosition}
      handleBack={handleBack}
      cardClass={cardClass}
    >
      {isComplete ? (
        <IntentSummary
          summaryQuestions={summaryQuestions}
          answers={answers}
          formatAnswer={formatAnswer}
          isSaving={isSaving}
          saveError={saveError}
        />
      ) : (
        <>
          <p className='text-base font-medium text-text-primary'>{activeQuestion.question}</p>

          {activeQuestion.type === 'choice' ? (
            <div className='mt-4 space-y-3'>
              {activeQuestion.options.map((option) => (
                <ChoiceOption
                  key={option.value}
                  option={option}
                  selected={answers[activeQuestion.id] === option.value}
                  onClick={() => handleChoice(option.value)}
                />
              ))}
            </div>
          ) : (
            <div className='mt-4'>
              {activeQuestion.id === 'description' ? (
                <textarea
                  autoFocus
                  className='min-h-[108px] w-full rounded-lg border border-white/[0.09] bg-background px-3.5 py-2.5 text-sm text-text-primary transition-[border-color,box-shadow] duration-150 hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20'
                  placeholder='e.g. A marketplace where photographers sell prints.'
                  value={descriptionValue}
                  onChange={(event) => setDescriptionValue(event.target.value)}
                />
              ) : (
                <input
                  type='text'
                  autoFocus
                  className='w-full rounded-lg border border-white/[0.09] bg-background px-3.5 py-2.5 text-sm text-text-primary transition-[border-color,box-shadow] duration-150 hover:border-white/[0.15] focus-visible:outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/20'
                  placeholder='app.myproduct.com'
                  value={domainValue}
                  onChange={(event) => setDomainValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleFreeNext()
                    }
                  }}
                />
              )}

              <Button
                variant='primary'
                className='mt-4'
                disabled={(activeQuestion.id === 'description' ? descriptionValue : domainValue).trim() === ''}
                onClick={handleFreeNext}
              >
                Next
                <ArrowRight className='h-4 w-4' />
              </Button>
            </div>
          )}
        </>
      )}
    </QuestionCard>
  )
}

export default StepTwoPanel
