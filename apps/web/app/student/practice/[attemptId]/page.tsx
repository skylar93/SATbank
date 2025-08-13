'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../../contexts/auth-context'
import { Navigation } from '../../../../components/navigation'
import { QuestionDisplay } from '../../../../components/exam/question-display'
import { ExamTimer } from '../../../../components/exam/exam-timer'
import { createClient } from '../../../../lib/supabase'
import { Question } from '../../../../lib/exam-service'

interface PracticeSettings {
  shuffleQuestions: boolean
  showExplanations: boolean
  timeLimit: number
  isIncorrectReview?: boolean
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
  const supabase = createClient()
  const attemptId = params.attemptId as string

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Map<string, UserAnswer>>(new Map())
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({
    shuffleQuestions: true,
    showExplanations: true,
    timeLimit: 0
  })
  const [loading, setLoading] = useState(true)
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now())
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())
  const [showExplanation, setShowExplanation] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [timeExpired, setTimeExpired] = useState(false)

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
        console.error('Practice session not found. Redirecting to problem bank.')
        router.push('/student/problem-bank')
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
        orderedQuestions = practiceData.questions.map((id: string) => 
          questionsData?.find(q => q.id === id)
        ).filter(Boolean)
      }

      setQuestions(orderedQuestions)

      // Update attempt status to in_progress
      const { error: updateError } = await supabase
        .from('test_attempts')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', attemptId)

      if (updateError) throw updateError

      setSessionStartTime(Date.now())
      setQuestionStartTime(Date.now())

    } catch (error) {
      console.error('Error initializing practice session:', error)
      console.error('Failed to start practice session. Please try again.')
      router.push('/student/problem-bank')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = useCallback(async (answer: string) => {
    const currentQuestion = questions[currentQuestionIndex]
    if (!currentQuestion) return

    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000)
    const isCorrect = answer === currentQuestion.correct_answer

    // Store answer locally
    const userAnswer: UserAnswer = {
      question_id: currentQuestion.id,
      user_answer: answer,
      is_correct: isCorrect,
      time_spent_seconds: timeSpent
    }

    setUserAnswers(prev => new Map(prev.set(currentQuestion.id, userAnswer)))

    // Save to database
    try {
      const { error } = await supabase
        .from('user_answers')
        .upsert({
          attempt_id: attemptId,
          question_id: currentQuestion.id,
          user_answer: answer,
          is_correct: isCorrect,
          time_spent_seconds: timeSpent
        })

      if (error) throw error
    } catch (error) {
      console.error('Error saving answer:', error)
    }

    // Show explanation if enabled
    if (practiceSettings.showExplanations && currentQuestion.explanation) {
      setShowExplanation(true)
    } else {
      goToNextQuestion()
    }
  }, [currentQuestionIndex, questions, attemptId, questionStartTime, practiceSettings.showExplanations])

  const goToNextQuestion = useCallback(() => {
    setShowExplanation(false)
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
      setQuestionStartTime(Date.now())
    } else {
      completePracticeSession()
    }
  }, [currentQuestionIndex, questions.length])

  const completePracticeSession = async () => {
    try {
      const totalTimeSpent = Math.floor((Date.now() - sessionStartTime) / 1000)
      const correctAnswers = Array.from(userAnswers.values()).filter(a => a.is_correct).length
      const totalScore = Math.round((correctAnswers / questions.length) * 100)

      // Update attempt status
      const { error: updateError } = await supabase
        .from('test_attempts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_score: totalScore,
          time_spent: { total: totalTimeSpent }
        })
        .eq('id', attemptId)

      if (updateError) throw updateError

      setIsComplete(true)

      // Clean up localStorage
      localStorage.removeItem(`practice_${attemptId}`)

    } catch (error) {
      console.error('Error completing practice session:', error)
    }
  }

  const handleTimeExpired = useCallback(() => {
    setTimeExpired(true)
    completePracticeSession()
  }, [])

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
      setQuestionStartTime(Date.now())
      setShowExplanation(false)
    }
  }

  const jumpToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index)
      setQuestionStartTime(Date.now())
      setShowExplanation(false)
    }
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
    const correctAnswers = Array.from(userAnswers.values()).filter(a => a.is_correct).length
    const accuracy = ((correctAnswers / questions.length) * 100).toFixed(1)
    
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              {timeExpired ? (
                <div className="text-red-600 mb-4">
                  <svg className="mx-auto h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-2xl font-bold">Time Expired!</h2>
                </div>
              ) : (
                <div className="text-green-600 mb-4">
                  <svg className="mx-auto h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-2xl font-bold">Practice Complete!</h2>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{correctAnswers}/{questions.length}</div>
                <div className="text-sm text-gray-600">Questions Correct</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{accuracy}%</div>
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
                onClick={() => router.push('/student/problem-bank')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors mr-4"
              >
                Back to Problem Bank
              </button>
              <button
                onClick={() => router.push(`/student/results/${attemptId}`)}
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

  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = userAnswers.get(currentQuestion?.id || '')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-6xl mx-auto py-4 px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Practice Session</h1>
              <p className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {questions.length}
                {practiceSettings.isIncorrectReview && ' • Reviewing Incorrect Answers'}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {practiceSettings.timeLimit > 0 && (
                <ExamTimer
                  initialTimeSeconds={practiceSettings.timeLimit * 60}
                  onTimeExpired={handleTimeExpired}
                />
              )}
              <div className="text-sm text-gray-600">
                Score: {Array.from(userAnswers.values()).filter(a => a.is_correct).length}/{userAnswers.size}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Question Navigation Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4 sticky top-4">
              <h3 className="font-medium text-gray-900 mb-3">Questions</h3>
              <div className="grid grid-cols-5 lg:grid-cols-1 gap-2">
                {questions.map((_, index) => {
                  const hasAnswer = userAnswers.has(questions[index]?.id || '')
                  const isCorrect = userAnswers.get(questions[index]?.id || '')?.is_correct
                  
                  return (
                    <button
                      key={index}
                      onClick={() => jumpToQuestion(index)}
                      className={`p-2 text-xs rounded transition-colors ${
                        index === currentQuestionIndex
                          ? 'bg-blue-600 text-white'
                          : hasAnswer
                          ? isCorrect
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {index + 1}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Question Content */}
          <div className="lg:col-span-3">
            {currentQuestion && (
              <div className="bg-white rounded-lg shadow-sm">
                {showExplanation && currentQuestion.explanation ? (
                  <div className="p-6">
                    <div className="mb-4">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        currentAnswer?.is_correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {currentAnswer?.is_correct ? '✓ Correct!' : '✗ Incorrect'}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">Your Answer:</h3>
                        <p className="text-gray-700">{currentAnswer?.user_answer}</p>
                      </div>

                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">Correct Answer:</h3>
                        <p className="text-green-700 font-medium">{currentQuestion.correct_answer}</p>
                      </div>

                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">Explanation:</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{currentQuestion.explanation}</p>
                      </div>
                    </div>

                    <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
                      <button
                        onClick={goToPreviousQuestion}
                        disabled={currentQuestionIndex === 0}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ← Previous
                      </button>
                      <button
                        onClick={goToNextQuestion}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors"
                      >
                        {currentQuestionIndex === questions.length - 1 ? 'Finish Practice' : 'Next Question →'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <QuestionDisplay
                    question={currentQuestion}
                    questionNumber={currentQuestionIndex + 1}
                    totalQuestions={questions.length}
                    userAnswer={currentAnswer?.user_answer}
                    onAnswerChange={handleAnswer}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}