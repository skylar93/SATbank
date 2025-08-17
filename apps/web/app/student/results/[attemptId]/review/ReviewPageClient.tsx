'use client'

import { useState, useMemo } from 'react'
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
      english1: 'Reading and Writing',
      english2: 'Writing and Language',
      math1: 'Math (No Calculator)',
      math2: 'Math (Calculator)',
    }
    return names[moduleType as keyof typeof names] || moduleType
  }

  // Get question status for navigation display
  const { correctQuestions, incorrectQuestions, answeredQuestions } = useMemo(() => {
    const correct = new Set<number>()
    const incorrect = new Set<number>()
    const answered = new Set<number>()
    
    reviewData.questions.forEach((question, index) => {
      const userAnswer = reviewData.userAnswers.find(ua => ua.question_id === question.id)
      const questionNumber = index + 1
      
      if (userAnswer?.user_answer) {
        answered.add(questionNumber)
        
        // Check if answer is correct
        let isCorrect = false
        
        if (question.question_type === 'grid_in') {
          // For grid-in questions, check against correct_answers array
          const correctAnswers = question.correct_answers || [question.correct_answer]
          const userAnswerTrimmed = userAnswer.user_answer.trim().toUpperCase()
          
          isCorrect = correctAnswers.some((correctAnswer) => {
            if (Array.isArray(correctAnswer)) {
              return correctAnswer.some((ca) => String(ca).trim().toUpperCase() === userAnswerTrimmed)
            }
            return String(correctAnswer).trim().toUpperCase() === userAnswerTrimmed
          })
        } else {
          // For multiple choice questions
          isCorrect = userAnswer.user_answer.trim().toUpperCase() === String(question.correct_answer).trim().toUpperCase()
        }
        
        if (isCorrect) {
          correct.add(questionNumber)
        } else {
          incorrect.add(questionNumber)
        }
      }
    })
    
    return { correctQuestions: correct, incorrectQuestions: incorrect, answeredQuestions: answered }
  }, [reviewData.questions, reviewData.userAnswers])

  // Get all modules for navigation
  const allModules = getAllModules()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-100 px-6 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                📖 Exam Review Mode
              </h1>
              <p className="text-gray-600">
                {reviewData.exam.title} - Review your answers in exam format
              </p>
              <div className="text-sm text-gray-500 mt-1">
                Completed: {formatDate(reviewData.attempt.completed_at || reviewData.attempt.created_at)}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Legend */}
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-1"></div>
                  <span className="text-gray-600">Correct</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-1"></div>
                  <span className="text-gray-600">Incorrect</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-400 rounded-full mr-1"></div>
                  <span className="text-gray-600">Unanswered</span>
                </div>
              </div>

              <Link
                href={`/student/results/${attemptId}`}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                ← Back to Results
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
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={totalQuestions}
            userAnswer={userAnswer || undefined}
            onAnswerChange={() => {}} // No-op in review mode
            showExplanation={showCorrectAnswers}
            disabled={true} // All inputs disabled in review mode
            isAdminPreview={false}
            isCorrect={isCorrect}
          />
        </div>

        {/* Review-specific Footer */}
        <div className="bg-white/80 backdrop-blur-sm border-t border-purple-100 px-6 py-4">
          <div className="max-w-7xl mx-auto">
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
                  Question {currentQuestionIndex + 1} of {totalQuestions} • {getModuleDisplayName(currentModule)}
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