'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../../../contexts/auth-context'
import { ExamInterface } from '../../../../../components/exam/ExamInterface'
import { supabase } from '../../../../../lib/supabase'
import { Question } from '../../../../../lib/exam-service'
import { validateGridInAnswer } from '../../../../../lib/grid-in-validator'

interface PracticeSettings {
  shuffleQuestions: boolean
  showExplanations: boolean
  timeLimit: number
  isMistakeReview?: boolean
}

interface UserAnswer {
  question_id: string
  user_answer: string
  is_correct: boolean
  time_spent_seconds: number
}

export default function PracticeSession() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  // Use the centralized Supabase client
  const attemptId = params.attemptId as string

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Map<string, UserAnswer>>(
    new Map()
  )
  const [currentInputAnswer, setCurrentInputAnswer] = useState('')
  const [showAnswerReveal, setShowAnswerReveal] = useState(false)
  const [answerRevealData, setAnswerRevealData] = useState<{
    question: Question
    userAnswer: string
    isCorrect: boolean
  } | null>(null)
  const [shouldShowCorrectAnswer, setShouldShowCorrectAnswer] =
    useState(false)
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({
    shuffleQuestions: true,
    showExplanations: true,
    timeLimit: 0,
  })
  const [loading, setLoading] = useState(true)
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now())
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())
  const [isComplete, setIsComplete] = useState(false)
  const [timeExpired, setTimeExpired] = useState(false)
  const timeExpiredRef = useRef(false)
  const questionContentRef = useRef<HTMLDivElement>(null)
  const [highlightsByQuestion, setHighlightsByQuestion] = useState<
    Record<string, any[]>
  >({})

  useEffect(() => {
    if (user && attemptId) {
      initializePracticeSession()
    }
  }, [user, attemptId])

  const initializePracticeSession = async () => {
    try {
      setLoading(true)

      // Get practice data from localStorage
      const practiceDataStr = localStorage.getItem(`practice_${attemptId}`)
      if (!practiceDataStr) {
        console.error(
          'Practice session not found. Redirecting to mistake notebook.'
        )
        router.push('/student/mistake-notebook')
        return
      }

      const practiceData = JSON.parse(practiceDataStr)
      setPracticeSettings(practiceData.settings)

      // Fetch questions for this practice session
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .in('id', practiceData.questions)

      if (questionsError) throw questionsError

      // Apply question order based on settings
      let orderedQuestions = questionsData || []
      if (practiceData.settings.shuffleQuestions) {
        // Questions are already shuffled in the practice data
        orderedQuestions = practiceData.questions
          .map((id: string) => questionsData?.find((q) => q.id === id))
          .filter(Boolean)
      }

      setQuestions(orderedQuestions)

      // Update attempt status to in_progress
      const { error: updateError } = await supabase
        .from('test_attempts')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', attemptId)

      if (updateError) throw updateError

      setSessionStartTime(Date.now())
      setQuestionStartTime(Date.now())
    } catch (error) {
      console.error('Error initializing practice session:', error)
      console.error('Failed to start practice session. Please try again.')
      router.push('/student/mistake-notebook')
    } finally {
      setLoading(false)
    }
  }

  const resetRevealState = useCallback(() => {
    setShowAnswerReveal(false)
    setAnswerRevealData(null)
    setShouldShowCorrectAnswer(false)
  }, [])

  const handleAnswerChange = useCallback(
    (answer: string) => {
      setCurrentInputAnswer(answer)
      if (showAnswerReveal) {
        resetRevealState()
      }
    },
    [resetRevealState, showAnswerReveal]
  )

  const handleCheckAnswer = useCallback(async () => {
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) return

    const trimmedAnswer = currentInputAnswer.trim()
    if (!trimmedAnswer) return

    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000)

    let isCorrect = false
    let storedAnswer = trimmedAnswer

    if (currentQuestion.question_type === 'multiple_choice') {
      const normalizedAttempt = trimmedAnswer.toUpperCase()
      const normalizedCorrect =
        (currentQuestion.correct_answer || '').trim().toUpperCase()
      storedAnswer = normalizedAttempt
      isCorrect = normalizedAttempt === normalizedCorrect
    } else if (currentQuestion.question_type === 'grid_in') {
      const validation = validateGridInAnswer(currentQuestion, trimmedAnswer)
      isCorrect = validation.isCorrect
    } else {
      isCorrect = trimmedAnswer === (currentQuestion.correct_answer || '')
    }

    const userAnswer: UserAnswer = {
      question_id: currentQuestion.id,
      user_answer: storedAnswer,
      is_correct: isCorrect,
      time_spent_seconds: timeSpent,
    }

    setUserAnswers((prev) => {
      const updated = new Map(prev)
      updated.set(currentQuestion.id, userAnswer)
      return updated
    })

    setCurrentInputAnswer(storedAnswer)

    try {
      const { error } = await supabase.from('user_answers').upsert({
        attempt_id: attemptId,
        question_id: currentQuestion.id,
        user_answer: storedAnswer,
        is_correct: isCorrect,
        time_spent_seconds: timeSpent,
        answered_at: new Date().toISOString(),
      })

      if (error) throw error
    } catch (error) {
      console.error('Error saving answer:', error)
    }

    setAnswerRevealData({
      question: currentQuestion,
      userAnswer: storedAnswer,
      isCorrect,
    })
    setShouldShowCorrectAnswer(true)
    setShowAnswerReveal(true)
  }, [
    attemptId,
    currentInputAnswer,
    currentQuestionIndex,
    questionStartTime,
    questions,
  ])

  const completePracticeSession = async () => {
    try {
      // Ensure all answers are processed before calculating score
      const allAnswers = Array.from(userAnswers.values())
      console.log('🔍 Practice completion - total answers:', allAnswers.length)
      console.log('🔍 Practice completion - total questions:', questions.length)

      const totalTimeSpent = Math.floor((Date.now() - sessionStartTime) / 1000)
      const correctAnswers = allAnswers.filter((a) => a.is_correct).length
      console.log('🔍 Practice completion - correct answers:', correctAnswers)

      const totalScore =
        questions.length > 0
          ? Math.round((correctAnswers / questions.length) * 100)
          : 0
      console.log('🔍 Practice completion - calculated score:', totalScore)

      setIsComplete(true)

      // Update attempt status and automatically release answers for practice sessions
      const { error: updateError } = await supabase
        .from('test_attempts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_score: totalScore,
          time_spent: { total: totalTimeSpent },
          answers_visible: true,
          answers_visible_after: new Date().toISOString(),
        })
        .eq('id', attemptId)

      if (updateError) throw updateError

      // If this is a mistake review practice session, update mistake_bank mastery status
      if (practiceSettings.isMistakeReview && user) {
        console.log('📚 Updating mistake bank mastery status')

        // Get all correct answers from this practice session
        const correctlyAnsweredQuestions = Array.from(userAnswers.values())
          .filter((answer) => answer.is_correct)
          .map((answer) => answer.question_id)

        if (correctlyAnsweredQuestions.length > 0) {
          const { error: mistakeUpdateError } = await supabase
            .from('mistake_bank')
            .update({
              status: 'mastered',
              last_reviewed_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)
            .in('question_id', correctlyAnsweredQuestions)

          if (mistakeUpdateError) {
            console.error('Error updating mistake bank:', mistakeUpdateError)
          } else {
            console.log(
              `✅ Updated ${correctlyAnsweredQuestions.length} questions to mastered status`
            )
          }
        }
      }

      // Redirect directly to review page instead of showing simple completion screen
      router.push(`/student/results/${attemptId}/review`)

      // Clean up localStorage
      localStorage.removeItem(`practice_${attemptId}`)
    } catch (error) {
      console.error('Error completing practice session:', error)
    }
  }

  const goToNextQuestion = useCallback(() => {
    resetRevealState()
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
      setQuestionStartTime(Date.now())
    } else {
      completePracticeSession()
    }
  }, [completePracticeSession, currentQuestionIndex, questions.length, resetRevealState])

  const handleAnswerRevealContinue = useCallback(() => {
    goToNextQuestion()
  }, [goToNextQuestion])

  const handleTryAgain = useCallback(() => {
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) return

    resetRevealState()
    setQuestionStartTime(Date.now())
    setUserAnswers((prev) => {
      if (!prev.has(currentQuestion.id)) {
        return prev
      }
      const updated = new Map(prev)
      updated.delete(currentQuestion.id)
      return updated
    })
  }, [currentQuestionIndex, questions, resetRevealState])

  const handleTimeExpired = useCallback(() => {
    timeExpiredRef.current = true
    setTimeExpired(true)
    completePracticeSession()
  }, [])

  const goToPreviousQuestion = () => {
    resetRevealState()
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
      setQuestionStartTime(Date.now())
    }
  }

  const jumpToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      resetRevealState()
      setCurrentQuestionIndex(index)
      setQuestionStartTime(Date.now())
    }
  }

  useEffect(() => {
    const question = questions[currentQuestionIndex]
    if (!question) {
      setCurrentInputAnswer('')
      resetRevealState()
      return
    }

    const savedAnswer = userAnswers.get(question.id)?.user_answer || ''
    setCurrentInputAnswer((prev) => (prev === savedAnswer ? prev : savedAnswer))

    if (answerRevealData?.question.id !== question.id) {
      resetRevealState()
    }
  }, [
    answerRevealData?.question.id,
    currentQuestionIndex,
    questions,
    resetRevealState,
    userAnswers,
  ])

  // Transform questions into module format for ExamInterface
  const currentModule = {
    module: 'practice' as any,
    questions,
    currentQuestionIndex,
    timeRemaining:
      practiceSettings.timeLimit > 0 ? practiceSettings.timeLimit * 60 : -1, // -1 indicates no time limit
    answers: Object.fromEntries(
      Array.from(userAnswers.entries()).map(([questionId, answer]) => [
        questionId,
        { answer: answer.user_answer, isCorrect: answer.is_correct },
      ])
    ),
  }

  const modules = [currentModule]
  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = currentInputAnswer

  // Helper functions for ExamInterface
  const getAnsweredQuestions = () => {
    const answeredSet = new Set<number>()
    questions.forEach((question, index) => {
      const answer = userAnswers.get(question.id)
      if (answer && answer.user_answer && answer.user_answer.trim() !== '') {
        answeredSet.add(index + 1) // Convert to 1-based indexing
      }
    })
    return answeredSet
  }

  const getMarkedQuestions = () => {
    // For practice mode, we don't have marking functionality yet
    return []
  }

  const handleExitAttempt = () => {
    router.push('/student/mistake-notebook')
  }

  const addHighlight = (questionId: string, highlight: any) => {
    setHighlightsByQuestion((prev) => ({
      ...prev,
      [questionId]: [...(prev[questionId] || []), highlight],
    }))
  }

  const removeHighlight = (questionId: string, highlight: any) => {
    setHighlightsByQuestion((prev) => ({
      ...prev,
      [questionId]: (prev[questionId] || []).filter((h) => h !== highlight),
    }))
  }

  if (!user) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading practice session...</p>
        </div>
      </div>
    )
  }

  if (isComplete || timeExpired) {
    const correctAnswers = Array.from(userAnswers.values()).filter(
      (a) => a.is_correct
    ).length
    const accuracy = ((correctAnswers / questions.length) * 100).toFixed(1)

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              {timeExpired ? (
                <div className="text-red-600 mb-4">
                  <svg
                    className="mx-auto h-16 w-16 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h2 className="text-2xl font-bold">Time Expired!</h2>
                </div>
              ) : (
                <div className="text-green-600 mb-4">
                  <svg
                    className="mx-auto h-16 w-16 mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <h2 className="text-2xl font-bold">Practice Complete!</h2>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {correctAnswers}/{questions.length}
                </div>
                <div className="text-sm text-gray-600">Questions Correct</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">
                  {accuracy}%
                </div>
                <div className="text-sm text-gray-600">Accuracy</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.floor((Date.now() - sessionStartTime) / 60000)}m
                </div>
                <div className="text-sm text-gray-600">Time Spent</div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => router.push('/student/mistake-notebook')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors mr-4"
              >
                Back to Mistake Notebook
              </button>
              <button
                onClick={() =>
                  router.push(`/student/results/${attemptId}/review`)
                }
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium transition-colors"
              >
                View Detailed Results
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ExamInterface
      exam={{ id: attemptId, title: 'Practice Session' }}
      currentModule={currentModule}
      currentQuestion={currentQuestion}
      currentAnswer={currentAnswer || ''}
      status={isComplete || timeExpired ? 'completed' : 'in_progress'}
      modules={modules}
      currentModuleIndex={0}
      timeExpiredRef={timeExpiredRef}
      questionContentRef={questionContentRef}
      highlightsByQuestion={highlightsByQuestion}
      answerCheckMode={'per_question'}
      showAnswerReveal={showAnswerReveal}
      answerRevealData={answerRevealData}
      shouldShowCorrectAnswer={shouldShowCorrectAnswer}
      onAnswerChange={handleAnswerChange}
      onNext={goToNextQuestion}
      onPrevious={goToPreviousQuestion}
      onGoToQuestion={jumpToQuestion}
      onSubmitModule={completePracticeSession}
      onSubmitExam={completePracticeSession}
      onTimeExpired={handleTimeExpired}
      onTimeUpdate={() => {}}
      onExitAttempt={handleExitAttempt}
      onCheckAnswer={handleCheckAnswer}
      onAnswerRevealContinue={handleAnswerRevealContinue}
      onTryAgain={handleTryAgain}
      getCurrentAnswer={() => currentInputAnswer}
      isMarkedForReview={() => false}
      toggleMarkForReview={() => {}}
      getMarkedQuestions={getMarkedQuestions}
      addHighlight={addHighlight}
      removeHighlight={removeHighlight}
      getAnsweredQuestions={getAnsweredQuestions}
    />
  )
}
