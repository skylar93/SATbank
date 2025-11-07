'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { QuestionDisplay } from '../../../../../../components/exam/question-display'
import { ExamNavigation } from '../../../../../../components/exam/exam-navigation'
import { useExamReviewState } from '../../../../../../hooks/use-exam-review-state'
import { supabase } from '../../../../../../lib/supabase'
import type {
  Question,
  TestAttempt,
  UserAnswer,
  Exam,
} from '../../../../../../lib/exam-service'

interface ReviewData {
  attempt: TestAttempt & { exams: Exam }
  exam: Exam
  questions: Question[]
  userAnswers: UserAnswer[]
}

interface ReviewPageClientProps {
  reviewData: ReviewData
  showCorrectAnswers: boolean
  attemptId: string
  isAdminView?: boolean
}

export default function ReviewPageClient({
  reviewData,
  showCorrectAnswers,
  attemptId,
  isAdminView = false,
}: ReviewPageClientProps) {
  const [questions, setQuestions] = useState(reviewData.questions)

  useEffect(() => {
    setQuestions(reviewData.questions)
  }, [reviewData.questions])

  const reviewDataWithUpdates = useMemo(
    () => ({
      ...reviewData,
      questions,
    }),
    [reviewData.attempt, reviewData.exam, reviewData.userAnswers, questions]
  )

  const {
    currentQuestionIndex,
    currentQuestion,
    currentModule,
    totalQuestions,
    userAnswer,
    isCorrect,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    getModuleQuestions,
    getAllModules,
    getCurrentModuleIndex,
    allQuestionsOrdered,
  } = useExamReviewState(reviewDataWithUpdates)

  // Admin regrade functionality
  const [regrading, setRegrading] = useState(false)
  const [regradeError, setRegradeError] = useState<string | null>(null)

  const handleQuestionUpdate = useCallback((updatedQuestion: Question) => {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === updatedQuestion.id ? updatedQuestion : question
      )
    )
  }, [])

  // Handle regrade question
  const handleRegrade = async () => {
    if (!isAdminView || !currentQuestion || !userAnswer) return

    const currentUserAnswer = reviewData.userAnswers.find(
      (ua) => ua.question_id === currentQuestion.id
    )

    if (!currentUserAnswer) return

    setRegrading(true)
    setRegradeError(null)

    try {
      // Get fresh session
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error(
          'Authentication failed. Please refresh the page and try again.'
        )
      }

      const response = await fetch('/api/admin/regrade-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          userAnswerId: currentUserAnswer.id,
          newIsCorrect: !isCorrect,
          reason: `Manual regrade via exam review interface - marking as ${!isCorrect ? 'correct' : 'incorrect'}`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to regrade question')
      }

      // Force a page reload to get fresh data
      window.location.reload()
    } catch (err: any) {
      console.error('Regrade error:', err)
      setRegradeError(err.message)
    } finally {
      setRegrading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getModuleDisplayName = (moduleType: string) => {
    const names = {
      english1: 'English Module 1',
      english2: 'English Module 2',
      math1: 'Math Module 1',
      math2: 'Math Module 2',
    }
    return names[moduleType as keyof typeof names] || moduleType
  }

  // Get question status for navigation display using the exact same ordering as the hook
  const {
    correctQuestions,
    incorrectQuestions,
    answeredQuestions,
    secondTryCorrectQuestions,
  } = useMemo(() => {
    const correct = new Set<number>()
    const incorrect = new Set<number>()
    const answered = new Set<number>()
    const secondTryCorrect = new Set<number>()

    // Use the exact same ordered questions array as the hook to ensure perfect consistency
    allQuestionsOrdered.forEach((question, index) => {
      const userAnswer = reviewData.userAnswers.find(
        (ua) => ua.question_id === question.id
      )
      const questionNumber = index + 1

      if (userAnswer?.user_answer) {
        answered.add(questionNumber)

        // Use the definitive is_correct value from the database (includes admin regrades)
        const isCorrect = userAnswer.is_correct ?? false

        if (isCorrect) {
          // Check if this was a second try (user viewed correct answer and then got it right)
          const hasViewedCorrectAnswer = userAnswer.viewed_correct_answer_at
          if (hasViewedCorrectAnswer) {
            secondTryCorrect.add(questionNumber)
          } else {
            correct.add(questionNumber)
          }
        } else {
          incorrect.add(questionNumber)
        }
      }
    })

    return {
      correctQuestions: correct,
      incorrectQuestions: incorrect,
      answeredQuestions: answered,
      secondTryCorrectQuestions: secondTryCorrect,
    }
  }, [allQuestionsOrdered, reviewData.userAnswers])

  // Get all modules for navigation
  const allModules = getAllModules()

  // Calculate current question number within the module
  const currentModuleIndex = getCurrentModuleIndex()
  const currentModuleQuestions = getModuleQuestions(currentModule)
  const questionIndexInModule = currentQuestion
    ? currentModuleQuestions.findIndex((q) => q.id === currentQuestion.id)
    : -1
  const currentQuestionInModule =
    questionIndexInModule >= 0 ? questionIndexInModule + 1 : 0
  const totalQuestionsInModule = currentModuleQuestions.length

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      const targetNode = event.target as Node | null

      if (targetNode) {
        let currentNode: Node | null = targetNode

        while (currentNode) {
          if (
            currentNode instanceof HTMLInputElement ||
            currentNode instanceof HTMLTextAreaElement ||
            currentNode instanceof HTMLSelectElement
          ) {
            return
          }

          if (
            currentNode instanceof HTMLElement &&
            (currentNode.isContentEditable ||
              currentNode.getAttribute('data-disable-exam-navigation') === 'true')
          ) {
            return
          }

          currentNode = currentNode.parentNode
        }
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          if (currentQuestionIndex > 0) {
            previousQuestion()
          }
          break
        case 'ArrowRight':
          event.preventDefault()
          if (currentQuestionIndex < totalQuestions - 1) {
            nextQuestion()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentQuestionIndex, totalQuestions, nextQuestion, previousQuestion])

  if (totalQuestions === 0 || !currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="max-w-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-purple-600">
            <span className="text-2xl">🤔</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">
            No question data available
          </h2>
          <p className="mt-3 text-gray-600">
            We couldn&apos;t find any questions for this exam review. The exam
            might not be fully synced yet or is using an unsupported module
            format. Please refresh the page or contact support if the issue
            persists.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-100 px-6 py-4 shadow-lg">
        <div className="mx-auto">
          <div className="flex items-center">
            <Link
              href={
                isAdminView
                  ? `/admin/results/${attemptId}`
                  : `/student/results/${attemptId}`
              }
              className="inline-flex items-center justify-center w-10 h-10 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors mr-4"
              title={isAdminView ? 'Back to Analysis' : 'Back to Results'}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>

            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {isAdminView ? 'Admin Exam Review' : 'Exam Review'}
              </h1>
              <p className="text-gray-600">{reviewData.exam.title}</p>
              <div className="text-sm text-gray-500 mt-1">
                Completed:{' '}
                {formatDate(
                  reviewData.attempt.completed_at ||
                    reviewData.attempt.created_at
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Compact Navigation Bar */}
        <ExamNavigation
          currentQuestion={currentQuestionIndex + 1}
          totalQuestions={totalQuestions}
          currentModule={currentModule}
          hasAnswer={!!userAnswer}
          isLastQuestion={currentQuestionIndex === totalQuestions - 1}
          isLastModule={true}
          onNext={nextQuestion}
          onPrevious={previousQuestion}
          onGoToQuestion={goToQuestion}
          onSubmitModule={() => {}}
          onSubmitExam={() => {}}
          answeredQuestions={answeredQuestions}
          markedQuestions={[]} // No marked questions in review mode
          disabled={false}
          isAdminPreview={true} // Use admin preview style for full navigation
          allModules={allModules}
          currentModuleIndex={getCurrentModuleIndex()}
          onGoToModule={(moduleIndex, questionIndex) => {
            const globalIndex =
              allModules
                .slice(0, moduleIndex)
                .reduce((acc, module) => acc + module.questions.length, 0) +
              questionIndex
            goToQuestion(globalIndex)
          }}
          isCompact={true}
          correctQuestions={correctQuestions}
          incorrectQuestions={incorrectQuestions}
          secondTryCorrectQuestions={secondTryCorrectQuestions}
        />

        {/* Question Display */}
        <div className="flex-1">
          {(() => {
            // Determine if current question is second try correct
            const currentUserAnswer = reviewData.userAnswers.find(
              (ua) => ua.question_id === currentQuestion.id
            )
            const isSecondTryCorrect =
              isCorrect && !!currentUserAnswer?.viewed_correct_answer_at

            return (
              <QuestionDisplay
                question={currentQuestion}
                questionNumber={currentQuestionInModule}
                totalQuestions={totalQuestionsInModule}
                userAnswer={userAnswer || undefined}
                onAnswerChange={() => {}} // No-op in review mode
                showExplanation={showCorrectAnswers}
                disabled={true} // All inputs disabled in review mode
                isAdminPreview={isAdminView}
                onQuestionUpdate={isAdminView ? handleQuestionUpdate : undefined}
                isCorrect={isCorrect}
                isSecondTryCorrect={isSecondTryCorrect}
                moduleDisplayName={getModuleDisplayName(currentModule)}
              />
            )
          })()}
        </div>

        {/* Review-specific Footer */}
        <div className="bg-white/80 backdrop-blur-sm border-t border-purple-100 px-6 py-4">
          <div className="mx-auto">
            {/* Admin Regrade Error Display */}
            {isAdminView && regradeError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{regradeError}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Status:</span>{' '}
                  <span
                    className={`font-semibold ${
                      !userAnswer
                        ? 'text-gray-500'
                        : isCorrect
                          ? 'text-green-600'
                          : 'text-red-600'
                    }`}
                  >
                    {!userAnswer
                      ? 'No answer'
                      : isCorrect
                        ? '✓ Correct'
                        : '✗ Incorrect'}
                  </span>
                </div>

                {userAnswer && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Selected:</span>{' '}
                    <span className="font-semibold text-gray-700">
                      {userAnswer}
                    </span>
                  </div>
                )}

                {/* Admin Regrade Button */}
                {isAdminView && userAnswer && (
                  <button
                    onClick={handleRegrade}
                    disabled={regrading}
                    className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                      isCorrect
                        ? 'bg-red-100 text-red-700 hover:bg-red-200 disabled:bg-red-50'
                        : 'bg-green-100 text-green-700 hover:bg-green-200 disabled:bg-green-50'
                    } disabled:cursor-not-allowed`}
                  >
                    {regrading
                      ? 'Regrading...'
                      : isCorrect
                        ? 'Mark as Incorrect'
                        : 'Mark as Correct'}
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-sm text-gray-500">
                  {getModuleDisplayName(currentModule)}:{' '}
                  {currentQuestionInModule} of {totalQuestionsInModule}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={previousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={nextQuestion}
                    disabled={currentQuestionIndex === totalQuestions - 1}
                    className="px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
