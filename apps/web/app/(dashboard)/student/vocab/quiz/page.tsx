'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Toast } from '@/components/ui/toast'
import { supabase } from '@/lib/supabase'
import { updateVocabWithSRS } from '@/lib/vocab-actions'
import { ArrowLeft, Check, X, RotateCcw } from 'lucide-react'
import Link from 'next/link'

interface VocabEntry {
  id: number
  term: string
  definition: string
  example_sentence: string | null
  mastery_level: number
}

interface QuizQuestion {
  id: number
  question: string
  correctAnswer: string
  options?: string[] // For multiple choice
  isCorrect?: boolean
  userAnswer?: string
}

interface QuizResult {
  questionId: number
  correct: boolean
  userAnswer: string
}

export default function VocabQuizPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setId = searchParams.get('setId')
  const quizType = searchParams.get('type') as 'term_to_def' | 'def_to_term'
  const quizFormat = searchParams.get('format') as
    | 'multiple_choice'
    | 'written_answer'
  const questionPool = searchParams.get('pool') as
    | 'all'
    | 'unmastered'
    | 'not_recent'
    | 'smart_review'

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswer, setUserAnswer] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [results, setResults] = useState<QuizResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isComplete, setIsComplete] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)

  // Use the centralized Supabase client

  useEffect(() => {
    if (!setId || !quizType || !quizFormat || !questionPool) {
      setToast({ message: 'Invalid quiz configuration', type: 'error' })
      router.push('/student/vocab')
      return
    }

    generateQuiz()
  }, [setId, quizType, quizFormat, questionPool])

  const generateQuiz = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setToast({ message: 'Please log in to take a quiz', type: 'error' })
        router.push('/login')
        return
      }

      // Fetch entries based on pool criteria
      let query = supabase
        .from('vocab_entries')
        .select('*')
        .eq('set_id', setId)
        .eq('user_id', user.id)

      if (questionPool === 'unmastered') {
        query = query.lt('mastery_level', 3)
      } else if (questionPool === 'not_recent') {
        const yesterday = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString()
        query = query.or(
          `last_reviewed_at.is.null,last_reviewed_at.lt.${yesterday}`
        )
      } else if (questionPool === 'smart_review') {
        // SRS: Get words that are due for review
        query = query.lte('next_review_date', new Date().toISOString())
      }

      const { data: entries, error } = await query

      if (error) throw error
      if (!entries || entries.length === 0) {
        setToast({
          message: 'No words available for this quiz configuration',
          type: 'error',
        })
        router.push(`/student/vocab/${setId}`)
        return
      }

      // Shuffle entries for quiz order
      const shuffledEntries = [...entries].sort(() => Math.random() - 0.5)

      // Generate questions
      const quizQuestions: QuizQuestion[] = await Promise.all(
        shuffledEntries.map(async (entry) => {
          const question =
            quizType === 'term_to_def' ? entry.term : entry.definition
          const correctAnswer =
            quizType === 'term_to_def' ? entry.definition : entry.term

          let options: string[] | undefined = undefined

          if (quizFormat === 'multiple_choice') {
            // Get 3 random incorrect options from other entries
            const otherEntries = entries.filter((e) => e.id !== entry.id)
            const shuffledOthers = [...otherEntries]
              .sort(() => Math.random() - 0.5)
              .slice(0, 3)

            const incorrectAnswers = shuffledOthers.map((e) =>
              quizType === 'term_to_def' ? e.definition : e.term
            )

            options = [correctAnswer, ...incorrectAnswers].sort(
              () => Math.random() - 0.5
            )
          }

          return {
            id: entry.id,
            question,
            correctAnswer,
            options,
          }
        })
      )

      setQuestions(quizQuestions)

      // Create quiz session record
      const { data: session, error: sessionError } = await supabase
        .from('quiz_sessions')
        .insert({
          user_id: user.id,
          set_id: parseInt(setId!),
          quiz_type: quizType,
          quiz_format: quizFormat,
          questions_total: quizQuestions.length,
          questions_correct: 0,
        })
        .select('id')
        .single()

      if (sessionError) throw sessionError
      setSessionId(session.id)
    } catch (error) {
      console.error('Error generating quiz:', error)
      setToast({ message: 'Failed to generate quiz', type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswerSubmit = () => {
    if (!userAnswer.trim() && quizFormat === 'written_answer') {
      setToast({ message: 'Please provide an answer', type: 'error' })
      return
    }

    const currentQuestion = questions[currentQuestionIndex]
    const isCorrect =
      quizFormat === 'multiple_choice'
        ? userAnswer === currentQuestion.correctAnswer
        : userAnswer.trim().toLowerCase() ===
          currentQuestion.correctAnswer.toLowerCase()

    const result: QuizResult = {
      questionId: currentQuestion.id,
      correct: isCorrect,
      userAnswer: userAnswer,
    }

    setResults((prev) => [...prev, result])

    // Update the current question with result
    setQuestions((prev) =>
      prev.map((q, index) =>
        index === currentQuestionIndex ? { ...q, isCorrect, userAnswer } : q
      )
    )

    setShowResult(true)
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
      setUserAnswer('')
      setShowResult(false)
    } else {
      // Quiz complete
      completeQuiz()
    }
  }

  const completeQuiz = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || !sessionId) return

      const correctAnswers = results.filter((r) => r.correct).length
      const scorePercentage = (correctAnswers / results.length) * 100

      // Update quiz session with final results
      const { error: sessionError } = await supabase
        .from('quiz_sessions')
        .update({
          questions_correct: correctAnswers,
          score_percentage: scorePercentage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      if (sessionError) throw sessionError

      // Update mastery levels and SRS scheduling for each vocab entry based on results
      const srsUpdates = results.map(async (result) => {
        try {
          const response = await updateVocabWithSRS(
            result.questionId,
            result.correct
          )
          if (!response.success) {
            console.error(
              'SRS update failed for entry',
              result.questionId,
              response.message
            )
          }
          return response
        } catch (error) {
          console.error(
            'Error updating SRS for entry',
            result.questionId,
            error
          )
          return { success: false, message: 'Update failed' }
        }
      })

      // Execute all SRS updates
      await Promise.all(srsUpdates)

      setIsComplete(true)
    } catch (error) {
      console.error('Error completing quiz:', error)
      setToast({ message: 'Failed to save quiz results', type: 'error' })
    }
  }

  const handleRetakeQuiz = () => {
    setCurrentQuestionIndex(0)
    setUserAnswer('')
    setShowResult(false)
    setResults([])
    setIsComplete(false)
    setSessionId(null)
    generateQuiz()
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress =
    questions.length > 0
      ? ((currentQuestionIndex + 1) / questions.length) * 100
      : 0

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto mb-6"></div>
            <div className="h-64 bg-gray-200 rounded mb-6"></div>
            <div className="h-12 bg-gray-200 rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  if (isComplete) {
    const correctAnswers = results.filter((r) => r.correct).length
    const scorePercentage = Math.round((correctAnswers / results.length) * 100)

    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl mb-2">Quiz Complete! 🎉</CardTitle>
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {scorePercentage}%
              </div>
              <p className="text-gray-600">
                You got {correctAnswers} out of {results.length} questions
                correct
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.map((result, index) => {
                  const question = questions.find(
                    (q) => q.id === result.questionId
                  )
                  if (!question) return null

                  return (
                    <div key={result.questionId} className="border rounded p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-1 rounded-full ${result.correct ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
                        >
                          {result.correct ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium mb-1">
                            {question.question}
                          </p>
                          <p className="text-sm text-green-600 mb-1">
                            Correct: {question.correctAnswer}
                          </p>
                          {!result.correct && (
                            <p className="text-sm text-red-600">
                              Your answer: {result.userAnswer}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-4 mt-6">
                <Button onClick={handleRetakeQuiz} className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Retake Quiz
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <Link href={`/student/vocab/${setId}`}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Words
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            No questions available
          </h1>
          <Link href={`/student/vocab/${setId}`}>
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Words
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Question Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center text-xl">
              {quizType === 'term_to_def'
                ? 'What does this term mean?'
                : 'What term has this definition?'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-8">
              <div className="text-2xl font-semibold text-gray-900 p-6 bg-gray-50 rounded-lg">
                {currentQuestion.question}
              </div>
            </div>

            {!showResult ? (
              <div className="space-y-4">
                {quizFormat === 'multiple_choice' ? (
                  <div className="space-y-3">
                    {currentQuestion.options?.map((option, index) => (
                      <label
                        key={index}
                        className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="radio"
                          name="answer"
                          value={option}
                          checked={userAnswer === option}
                          onChange={(e) => setUserAnswer(e.target.value)}
                          className="mr-3"
                        />
                        <span className="text-lg">{option}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] text-lg"
                      autoFocus
                    />
                  </div>
                )}

                <Button
                  onClick={handleAnswerSubmit}
                  disabled={!userAnswer.trim()}
                  className="w-full py-3 text-lg"
                >
                  Submit Answer
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Result Display */}
                <div
                  className={`text-center p-6 rounded-lg ${
                    currentQuestion.isCorrect
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div
                    className={`text-3xl mb-3 ${
                      currentQuestion.isCorrect
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {currentQuestion.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                  </div>

                  {!currentQuestion.isCorrect && (
                    <div className="space-y-2">
                      <p className="text-red-700">
                        <span className="font-medium">Your answer:</span>{' '}
                        {currentQuestion.userAnswer}
                      </p>
                      <p className="text-green-700">
                        <span className="font-medium">Correct answer:</span>{' '}
                        {currentQuestion.correctAnswer}
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleNextQuestion}
                  className="w-full py-3 text-lg"
                >
                  {currentQuestionIndex < questions.length - 1
                    ? 'Next Question'
                    : 'Finish Quiz'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Back Link */}
        <div className="text-center">
          <Link
            href={`/student/vocab/${setId}`}
            className="text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4 inline mr-1" />
            Back to vocabulary set
          </Link>
        </div>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  )
}
