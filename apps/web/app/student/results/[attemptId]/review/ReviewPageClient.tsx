'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { QuestionDisplay } from '../../../../../components/exam/question-display'
import { ExamNavigation } from '../../../../../components/exam/exam-navigation'
import { useExamReviewState } from '../../../../../hooks/use-exam-review-state'
import type { Question, TestAttempt, UserAnswer, Exam } from '../../../../../lib/exam-service'

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
}

export default function ReviewPageClient({
  reviewData,
  showCorrectAnswers,
  attemptId,
}: ReviewPageClientProps) {
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
  } = useExamReviewState(reviewData)

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
  const { correctQuestions, incorrectQuestions, answeredQuestions } = useMemo(() => {
    const correct = new Set<number>()
    const incorrect = new Set<number>()
    const answered = new Set<number>()
    
    // Use the exact same ordered questions array as the hook to ensure perfect consistency
    allQuestionsOrdered.forEach((question, index) => {
      const userAnswer = reviewData.userAnswers.find(ua => ua.question_id === question.id)
      const questionNumber = index + 1
      
      if (userAnswer?.user_answer) {
        answered.add(questionNumber)
        
        // Use the definitive is_correct value from the database (includes admin regrades)
        const isCorrect = userAnswer.is_correct ?? false
        
        if (isCorrect) {
          correct.add(questionNumber)
        } else {
          incorrect.add(questionNumber)
        }
      }
    })
    
    return { correctQuestions: correct, incorrectQuestions: incorrect, answeredQuestions: answered }
  }, [allQuestionsOrdered, reviewData.userAnswers])

  // Get all modules for navigation
  const allModules = getAllModules()

  // Calculate current question number within the module
  const currentModuleIndex = getCurrentModuleIndex()
  const currentModuleQuestions = getModuleQuestions(currentModule)
  const questionIndexInModule = currentModuleQuestions.findIndex(q => q.id === currentQuestion.id)
  const currentQuestionInModule = questionIndexInModule + 1
  const totalQuestionsInModule = currentModuleQuestions.length

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle arrow keys and ignore if user is typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-100 px-6 py-4 shadow-lg">
        <div className="mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Exam Review
              </h1>
              <p className="text-gray-600">
                {reviewData.exam.title}
              </p>
              <div className="text-sm text-gray-500 mt-1">
                Completed: {formatDate(reviewData.attempt.completed_at || reviewData.attempt.created_at)}
              </div>
            </div>
            
            <div className="flex items-center">
              <Link
                href={`/student/results/${attemptId}`}
                className="inline-flex items-center justify-center w-10 h-10 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="Back to Results"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
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
            const globalIndex = allModules
              .slice(0, moduleIndex)
              .reduce((acc, module) => acc + module.questions.length, 0) + questionIndex
            goToQuestion(globalIndex)
          }}
          isCompact={true}
          correctQuestions={correctQuestions}
          incorrectQuestions={incorrectQuestions}
        />

        {/* Question Display */}
        <div className="flex-1">
          <QuestionDisplay
            question={currentQuestion}
            questionNumber={currentQuestionInModule}
            totalQuestions={totalQuestionsInModule}
            userAnswer={userAnswer || undefined}
            onAnswerChange={() => {}} // No-op in review mode
            showExplanation={showCorrectAnswers}
            disabled={true} // All inputs disabled in review mode
            isAdminPreview={false}
            isCorrect={isCorrect}
            moduleDisplayName={getModuleDisplayName(currentModule)}
          />
        </div>

        {/* Review-specific Footer */}
        <div className="bg-white/80 backdrop-blur-sm border-t border-purple-100 px-6 py-4">
          <div className="mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Status:</span>{' '}
                  <span className={`font-semibold ${
                    !userAnswer 
                      ? 'text-gray-500'
                      : (isCorrect ? 'text-green-600' : 'text-red-600')
                  }`}>
                    {!userAnswer ? 'No answer' : (isCorrect ? '✓ Correct' : '✗ Incorrect')}
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
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-sm text-gray-500">
                  {getModuleDisplayName(currentModule)}: {currentQuestionInModule} of {totalQuestionsInModule}
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