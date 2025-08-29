import { useState, useCallback } from 'react'
import { ExamService } from '../lib/exam-service'

interface UseExamAnswerProps {
  setLocalAnswer: (answer: string) => void
  getCurrentQuestion: () => any
  attempt: any
}

export const useExamAnswer = ({
  setLocalAnswer,
  getCurrentQuestion,
  attempt,
}: UseExamAnswerProps) => {
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [isUserSelecting, setIsUserSelecting] = useState(false)
  const [answerCheckMode, setAnswerCheckMode] = useState<
    'exam_end' | 'per_question'
  >('exam_end')
  const [showAnswerReveal, setShowAnswerReveal] = useState(false)
  const [answerRevealData, setAnswerRevealData] = useState<{
    question: any
    userAnswer: string
    isCorrect: boolean
  } | null>(null)
  const [shouldShowCorrectAnswer, setShouldShowCorrectAnswer] = useState(false)

  // Handle answer change
  const handleAnswerChange = useCallback(
    async (answer: string, timeExpiredRef: React.RefObject<boolean>) => {
      // Prevent input if time has expired
      if (timeExpiredRef.current) {
        return
      }

      setIsUserSelecting(true)
      setCurrentAnswer(answer)

      // Store answer locally only - not saved to database until module completion
      setLocalAnswer(answer)

      // Clear any existing answer reveal state when answer changes
      // This allows student to try again with different answer
      if (showAnswerReveal) {
        setShowAnswerReveal(false)
        setAnswerRevealData(null)
        setShouldShowCorrectAnswer(false)
      }

      // In per-question mode, just store the answer - don't auto-submit
      // User will need to click "Check Answer" button to see results

      // Clear the flag after a short delay to allow answer loading on navigation
      setTimeout(() => setIsUserSelecting(false), 100)
    },
    [setLocalAnswer, showAnswerReveal]
  )

  // Handle checking answer in per-question mode
  const handleCheckAnswer = useCallback(async () => {
    if (answerCheckMode === 'per_question' && attempt && currentAnswer.trim()) {
      try {
        const currentQuestion = getCurrentQuestion()
        if (currentQuestion) {
          const result = await ExamService.submitAnswerWithView({
            attempt_id: attempt.id,
            question_id: currentQuestion.id,
            user_answer: currentAnswer,
            time_spent_seconds: 0,
          })

          setAnswerRevealData({
            question: result.question,
            userAnswer: currentAnswer,
            isCorrect: result.isCorrect,
          })
          // For incorrect answers on first attempt, don't show correct answer yet
          setShouldShowCorrectAnswer(result.isCorrect)
          setShowAnswerReveal(true)
        }
      } catch (error) {
        console.error('Error submitting answer with view:', error)
      }
    }
  }, [answerCheckMode, attempt, currentAnswer, getCurrentQuestion])

  // Save current answer locally before navigation
  const saveCurrentAnswer = useCallback(() => {
    if (currentAnswer.trim()) {
      setLocalAnswer(currentAnswer)
    }
  }, [currentAnswer, setLocalAnswer])

  // Handle try again - reset answer submission state so student can try again
  const handleTryAgain = useCallback(() => {
    setShowAnswerReveal(false)
    setAnswerRevealData(null)
    setShouldShowCorrectAnswer(false)
    // Keep the current answer so they can modify it and try again
  }, [])

  // Reset answer reveal state
  const resetAnswerReveal = useCallback(() => {
    setShowAnswerReveal(false)
    setAnswerRevealData(null)
    setShouldShowCorrectAnswer(false)
  }, [])

  // Update current answer from external source (e.g., when navigating)
  const updateCurrentAnswer = useCallback(
    (answer: string) => {
      if (!isUserSelecting) {
        setCurrentAnswer(answer || '')
      }
    },
    [isUserSelecting]
  )

  return {
    currentAnswer,
    setCurrentAnswer,
    isUserSelecting,
    setIsUserSelecting,
    answerCheckMode,
    setAnswerCheckMode,
    showAnswerReveal,
    answerRevealData,
    shouldShowCorrectAnswer,
    setShouldShowCorrectAnswer,
    handleAnswerChange,
    handleCheckAnswer,
    saveCurrentAnswer,
    handleTryAgain,
    resetAnswerReveal,
    updateCurrentAnswer,
  }
}
