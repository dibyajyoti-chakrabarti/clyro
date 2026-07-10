import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../../api'
import { getQuestions } from '../constants/questions'

export default function useQuestionFlow({ projectId, projectData, setProjectData, setStep2CanContinue }) {
  const hasPostgres = projectData.scanResult?.detected_resources?.infrastructure?.database?.detected ?? true
  const hasWorker = projectData.scanResult?.detected_resources?.services?.worker?.detected ?? false

  const questions = useMemo(() => getQuestions(hasPostgres, hasWorker), [hasPostgres, hasWorker])

  const hasRestoredIntent = !!projectData.intent?.scale
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState(() => projectData.intent || {})
  const [direction, setDirection] = useState('forward')
  const [isComplete, setIsComplete] = useState(hasRestoredIntent)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [cardStage, setCardStage] = useState('idle')
  const [descriptionValue, setDescriptionValue] = useState(projectData.intent?.description || '')
  const [domainValue, setDomainValue] = useState(projectData.intent?.domain_name || '')
  const transitionTimerRef = useRef(null)
  const enterTimerRef = useRef(null)

  useEffect(() => {
    setStep2CanContinue(isComplete && !isSaving)
  }, [isComplete, isSaving, setStep2CanContinue])

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current)
      }
      if (enterTimerRef.current) {
        clearTimeout(enterTimerRef.current)
      }
    }
  }, [])

  const isVisible = (question, currentAnswers) => {
    if (!question.condition) {
      return true
    }

    return question.condition(currentAnswers)
  }

  const visibleIndexes = questions
    .map((question, index) => (isVisible(question, answers) ? index : -1))
    .filter((index) => index !== -1)

  const safeCurrentQ = isComplete
    ? currentQ
    : (isVisible(questions[currentQ], answers) ? currentQ : visibleIndexes[0] || 0)

  const activeQuestion = isComplete ? null : questions[safeCurrentQ]
  const currentVisiblePosition = isComplete ? visibleIndexes.length : visibleIndexes.indexOf(safeCurrentQ)
  const totalVisible = visibleIndexes.length
  const questionNumber = isComplete ? totalVisible : currentVisiblePosition + 1
  const progressPercent = isComplete ? 100 : Math.round((currentVisiblePosition / totalVisible) * 100)

  const getNextIndex = (fromIndex, nextAnswers) => {
    for (let i = fromIndex + 1; i < questions.length; i += 1) {
      if (isVisible(questions[i], nextAnswers)) {
        return i
      }
    }

    return questions.length
  }

  const getPrevIndex = (fromIndex, nextAnswers) => {
    for (let i = fromIndex - 1; i >= 0; i -= 1) {
      if (isVisible(questions[i], nextAnswers)) {
        return i
      }
    }

    return 0
  }

  const transitionTo = (nextIndex, travelDirection) => {
    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current)
    }
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current)
    }

    setDirection(travelDirection)
    setCardStage('exit')

    transitionTimerRef.current = setTimeout(() => {
      setCurrentQ(nextIndex)
      setCardStage('enter')

      enterTimerRef.current = setTimeout(() => {
        setCardStage('idle')
      }, 20)
    }, 120)
  }

  const finalizeIntent = (finalAnswers) => {
    setIsComplete(true)
    setProjectData((prev) => ({ ...prev, intent: finalAnswers }))
    setIsSaving(true)
    setSaveError('')
    api.saveIntent(projectId, { ...finalAnswers, compute_choice: 'ecs_fargate' })
      .then(() => setIsSaving(false))
      .catch((err) => {
        setIsSaving(false)
        setSaveError(err.message || 'Failed to save — your answers may not be persisted')
      })
  }

  const advanceWithAnswers = (nextAnswers) => {
    const nextIndex = getNextIndex(safeCurrentQ, nextAnswers)

    if (nextIndex >= questions.length) {
      finalizeIntent(nextAnswers)
      return
    }

    transitionTo(nextIndex, 'forward')
  }

  const handleChoice = (value) => {
    if (!activeQuestion) {
      return
    }

    const nextAnswers = {
      ...answers,
      [activeQuestion.id]: value,
    }

    setAnswers(nextAnswers)
    setDirection('forward')

    setTimeout(() => {
      advanceWithAnswers(nextAnswers)
    }, 300)
  }

  const handleFreeNext = () => {
    if (!activeQuestion) {
      return
    }

    const value = activeQuestion.id === 'description' ? descriptionValue.trim() : domainValue.trim()
    if (!value) {
      return
    }

    const nextAnswers = {
      ...answers,
      [activeQuestion.id]: value,
    }
    setAnswers(nextAnswers)
    advanceWithAnswers(nextAnswers)
  }

  const handleBack = () => {
    if (isComplete) {
      const fallback = visibleIndexes[visibleIndexes.length - 1] || 0
      setIsComplete(false)
      setDirection('back')
      setCurrentQ(fallback)
      return
    }

    const prevIndex = getPrevIndex(safeCurrentQ, answers)
    if (prevIndex === safeCurrentQ) {
      return
    }

    transitionTo(prevIndex, 'back')
  }

  const cardClass = () => {
    if (cardStage === 'exit') {
      return direction === 'forward' ? '-translate-x-full opacity-0' : 'translate-x-full opacity-0'
    }

    if (cardStage === 'enter') {
      return direction === 'forward' ? 'translate-x-full opacity-0' : '-translate-x-full opacity-0'
    }

    return 'translate-x-0 opacity-100'
  }

  const questionLookup = questions.reduce((acc, q) => {
    acc[q.id] = q
    return acc
  }, {})

  const formatAnswer = (questionId, rawValue) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return '-'
    }

    const question = questionLookup[questionId]
    if (!question || question.type === 'free') {
      return String(rawValue)
    }

    const match = question.options.find((item) => item.value === rawValue)
    return match ? match.label : String(rawValue)
  }

  const summaryQuestions = questions.filter((q) => {
    if (q.id === 'domain_name' && answers.domain_has !== 'yes') {
      return false
    }

    return answers[q.id] !== undefined
  })

  return {
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
  }
}
