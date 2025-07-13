'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../../contexts/auth-context'
import { useExamState } from '../../../../hooks/use-exam-state'
import { ExamTimer } from '../../../../components/exam/exam-timer'
import { QuestionDisplay } from '../../../../components/exam/question-display'
import { ExamNavigation } from '../../../../components/exam/exam-navigation'
import { Navigation } from '../../../../components/navigation'

export default function ExamPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const examId = params.examId as string

  const {
    examState,
    loading,
    error,
    initializeExam,
    startExam,
    submitAnswer,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    nextModule,
    completeExam,
    handleTimeExpired,
    updateTimer,
    getCurrentQuestion,
    getCurrentAnswer
  } = useExamState()

  const [showStartScreen, setShowStartScreen] = useState(true)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [isUserSelecting, setIsUserSelecting] = useState(false)

  // Initialize exam when component mounts
  useEffect(() => {
    if (!authLoading && user && examId) {
      initializeExam(examId)
    }
  }, [authLoading, user, examId, initializeExam])

  // Update current answer when question changes (but not when user is actively selecting)
  useEffect(() => {
    if (examState.modules.length > 0 && !isUserSelecting) {
      const currentModule = examState.modules[examState.currentModuleIndex]
      if (currentModule) {
        const currentQuestion = currentModule.questions[currentModule.currentQuestionIndex]
        if (currentQuestion) {
          const existingAnswer = currentModule.answers[currentQuestion.id]?.answer
          setCurrentAnswer(existingAnswer || '')
        }
      }
    }
  }, [examState.modules, examState.currentModuleIndex, examState.modules[examState.currentModuleIndex]?.currentQuestionIndex, isUserSelecting])

  // Handle exam start
  const handleStartExam = async () => {
    await startExam()
    setShowStartScreen(false)
  }

  // Handle answer change
  const handleAnswerChange = async (answer: string) => {
    setIsUserSelecting(true)
    setCurrentAnswer(answer)
    // Immediately submit the answer to persist it
    await submitAnswer(answer)
    // Clear the flag after a short delay to allow answer loading on navigation
    setTimeout(() => setIsUserSelecting(false), 100)
  }

  // Save current answer before navigation
  const saveCurrentAnswer = async () => {
    if (currentAnswer.trim()) {
      await submitAnswer(currentAnswer)
    }
  }

  // Handle previous question
  const handlePrevious = async () => {
    await saveCurrentAnswer()
    setIsUserSelecting(false)
    previousQuestion()
  }

  // Handle go to specific question
  const handleGoToQuestion = async (questionIndex: number) => {
    await saveCurrentAnswer()
    setIsUserSelecting(false)
    goToQuestion(questionIndex)
  }

  // Handle next question
  const handleNext = async () => {
    await saveCurrentAnswer()
    setIsUserSelecting(false)
    nextQuestion()
  }

  // Handle module completion
  const handleSubmitModule = async () => {
    await saveCurrentAnswer()
    await nextModule()
  }

  // Handle exam completion
  const handleSubmitExam = async () => {
    await saveCurrentAnswer()
    await completeExam()
    router.push('/student/results')
  }

  // Get answered questions for current module
  const getAnsweredQuestions = () => {
    const currentModule = examState.modules[examState.currentModuleIndex]
    if (!currentModule) return new Set<number>()
    
    const answeredSet = new Set<number>()
    currentModule.questions.forEach((question, index) => {
      if (currentModule.answers[question.id]) {
        answeredSet.add(index + 1) // Convert to 1-based indexing
      }
    })
    return answeredSet
  }

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading exam...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-600 text-xl mb-4">Error loading exam</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/student/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Exam not loaded
  if (!examState.exam) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-600">Exam not found</p>
            <button
              onClick={() => router.push('/student/dashboard')}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Pre-exam start screen
  if (showStartScreen) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
              {examState.exam.title}
            </h1>
            
            <div className="mb-8">
              <p className="text-lg text-gray-700 mb-4">
                {examState.exam.description}
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">Exam Instructions:</h3>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>This exam consists of 4 modules: English 1, English 2, Math 1, Math 2</li>
                  <li>Each module has a strict time limit</li>
                  <li>You cannot return to previous questions or modules</li>
                  <li>Answer all questions to the best of your ability</li>
                  <li>The exam will auto-submit when time expires</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {examState.modules.map((module, index) => (
                  <div key={module.module} className="bg-gray-50 p-4 rounded-lg text-center">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      {module.module.replace(/(\d)/, ' $1').toUpperCase()}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {module.questions.length} questions
                    </p>
                    <p className="text-sm text-gray-600">
                      {module.timeLimit} minutes
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={handleStartExam}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
              >
                Start Exam
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main exam interface
  const currentModule = examState.modules[examState.currentModuleIndex]
  const currentQuestion = getCurrentQuestion()
  
  if (!currentModule || !currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-600">Loading question...</p>
        </div>
      </div>
    )
  }

  const isLastQuestion = currentModule.currentQuestionIndex === currentModule.questions.length - 1
  const isLastModule = examState.currentModuleIndex === examState.modules.length - 1

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header with Timer */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {examState.exam.title}
            </h1>
            <span className="text-sm text-gray-500">
              {currentModule.module.replace(/(\d)/, ' $1').toUpperCase()}
            </span>
          </div>
          
          <ExamTimer
            initialTimeSeconds={currentModule.timeRemaining}
            onTimeExpired={handleTimeExpired}
            onTimeUpdate={updateTimer}
            isPaused={examState.status !== 'in_progress'}
          />
        </div>
      </div>

      {/* Main Question Area */}
      <div className="flex-1 overflow-hidden">
        <QuestionDisplay
          question={currentQuestion}
          questionNumber={currentModule.currentQuestionIndex + 1}
          totalQuestions={currentModule.questions.length}
          userAnswer={currentAnswer}
          onAnswerChange={handleAnswerChange}
        />
      </div>

      {/* Navigation */}
      <ExamNavigation
        currentQuestion={currentModule.currentQuestionIndex + 1}
        totalQuestions={currentModule.questions.length}
        currentModule={currentModule.module}
        hasAnswer={!!currentAnswer}
        isLastQuestion={isLastQuestion}
        isLastModule={isLastModule}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onGoToQuestion={handleGoToQuestion}
        onSubmitModule={handleSubmitModule}
        onSubmitExam={handleSubmitExam}
        answeredQuestions={getAnsweredQuestions()}
        disabled={examState.status !== 'in_progress'}
      />
    </div>
  )
}