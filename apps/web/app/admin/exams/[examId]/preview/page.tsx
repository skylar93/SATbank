'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '../../../../../contexts/auth-context'
import { useAdminPreviewState } from '../../../../../hooks/use-admin-preview-state'
import { type Question } from '../../../../../lib/exam-service'
import { QuestionDisplay } from '../../../../../components/exam/question-display'
import { ExamNavigation } from '../../../../../components/exam/exam-navigation'
import { AcademicCapIcon, BookOpenIcon, ClockIcon } from '@heroicons/react/24/outline'
import { devLogger } from '../../../../../lib/logger'

function AdminExamPreviewContent() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading, isAdmin } = useAuth()
  const examId = params.examId as string
  
  const {
    examState,
    loading,
    error,
    initializeExam,
    setLocalAnswer,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    goToModuleAndQuestion,
    updateQuestionInState,
    nextModule,
    getCurrentQuestion,
    getCurrentAnswer,
    toggleMarkForReview,
    isMarkedForReview,
    getMarkedQuestions
  } = useAdminPreviewState()

  const [showStartScreen, setShowStartScreen] = useState(true)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [isUserSelecting, setIsUserSelecting] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)
  
  // Reset initialization flag when examId changes
  useEffect(() => {
    setHasInitialized(false)
  }, [examId])

  // Security check - only allow admin users
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/admin/exams')
      return
    }
  }, [authLoading, user, isAdmin, router])

  // Initialize exam when component mounts
  useEffect(() => {
    if (!authLoading && user && isAdmin && examId && !hasInitialized && !loading) {
      setHasInitialized(true)
      initializeExam(examId)
    }
  }, [authLoading, user, isAdmin, examId, hasInitialized, loading, initializeExam, router])

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
    setShowStartScreen(false)
  }

  // Hide start screen when exam is in progress
  useEffect(() => {
    if (examState.status === 'in_progress') {
      setShowStartScreen(false)
    }
  }, [examState.status])

  // Handle answer change
  const handleAnswerChange = (answer: string) => {
    setIsUserSelecting(true)
    setCurrentAnswer(answer)
    
    // Store answer locally in preview state
    setLocalAnswer(answer)
    
    // Clear the flag after a short delay to allow answer loading on navigation
    setTimeout(() => setIsUserSelecting(false), 100)
  }

  // Save current answer locally before navigation
  const saveCurrentAnswer = () => {
    if (currentAnswer.trim()) {
      setLocalAnswer(currentAnswer)
    }
  }

  // Handle question updates during admin preview
  const handleQuestionUpdate = (updatedQuestion: Question) => {
    // Update the question in the cached exam state so it persists during navigation
    updateQuestionInState(updatedQuestion)
  }

  // Handle previous question
  const handlePrevious = () => {
    saveCurrentAnswer()
    setIsUserSelecting(false)
    previousQuestion()
  }

  // Handle go to specific question
  const handleGoToQuestion = (questionIndex: number) => {
    saveCurrentAnswer()
    setIsUserSelecting(false)
    goToQuestion(questionIndex)
  }
  
  // Handle admin navigation to specific module and question
  const handleGoToModule = (moduleIndex: number, questionIndex: number) => {
    saveCurrentAnswer()
    setIsUserSelecting(false)
    
    goToModuleAndQuestion(moduleIndex, questionIndex)
  }

  // Handle next question
  const handleNext = () => {
    saveCurrentAnswer()
    setIsUserSelecting(false)
    nextQuestion()
  }

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle keyboard navigation when not typing in inputs
      if (examState.status !== 'in_progress') return
      
      const target = event.target as HTMLElement
      const isInputActive = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      
      if (isInputActive) return
      
      const currentModule = examState.modules[examState.currentModuleIndex]
      if (!currentModule) return
      
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (currentModule.currentQuestionIndex > 0) {
          handlePrevious()
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (currentModule.currentQuestionIndex < currentModule.questions.length - 1) {
          handleNext()
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [examState.status, examState.modules, examState.currentModuleIndex, handleNext, handlePrevious])

  // Handle module completion
  const handleSubmitModule = async () => {
    saveCurrentAnswer()
    nextModule()
  }

  // Handle exam completion
  const handleSubmitExam = async () => {
    saveCurrentAnswer()
    router.push('/admin/exams')
  }

  // Get answered questions for all modules in admin preview
  const getAnsweredQuestions = () => {
    const answeredSet = new Set<number>()
    let globalIndex = 1
    
    examState.modules.forEach((module) => {
      module.questions.forEach((question) => {
        if (module.answers[question.id]) {
          answeredSet.add(globalIndex)
        }
        globalIndex++
      })
    })
    return answeredSet
  }

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading exam preview...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-600 text-xl mb-4">Error loading exam preview</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="text-xs text-gray-500 mb-4">
              Admin Preview Mode<br/>
              Exam ID: {examId}
            </div>
            <button
              onClick={() => router.push('/admin/exams')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Return to Admin Panel
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
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-600">Exam not found</p>
            <button
              onClick={() => router.push('/admin/exams')}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Return to Admin Panel
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
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="text-orange-800 font-medium flex items-center">
                  <span className="mr-2">🔍</span>
                  Admin Preview Mode
                </span>
                <button
                  onClick={() => router.push('/admin/exams')}
                  className="text-purple-600 hover:text-purple-800 text-sm font-semibold underline transition-colors duration-200"
                >
                  ← Back to Admin Panel
                </button>
              </div>
            </div>
            
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AcademicCapIcon className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {examState.exam.title}
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {examState.exam.description}
              </p>
            </div>
            
            <div className="mb-8">
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-6 mb-8">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center">
                    <BookOpenIcon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-violet-800">Admin Preview Features</h3>
                </div>
                <ul className="space-y-3 text-violet-700">
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                    <span>Navigate freely between all modules and questions</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                    <span>Edit questions directly in the preview interface</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                    <span>No time limits or restrictions</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                    <span>Test answers without saving to database</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                    <span>Use arrow keys for quick navigation</span>
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {examState.modules.map((module, index) => {
                  const colors = [
                    'from-indigo-50 to-indigo-100 border-indigo-200',
                    'from-violet-50 to-violet-100 border-violet-200', 
                    'from-purple-50 to-purple-100 border-purple-200',
                    'from-pink-50 to-pink-100 border-pink-200'
                  ]
                  const iconColors = ['bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-pink-500']
                  const hoverColors = [
                    'hover:from-indigo-100 hover:to-indigo-200',
                    'hover:from-violet-100 hover:to-violet-200',
                    'hover:from-purple-100 hover:to-purple-200', 
                    'hover:from-pink-100 hover:to-pink-200'
                  ]
                  
                  return (
                    <div key={module.module} className={`bg-gradient-to-r ${colors[index]} border ${hoverColors[index]} p-6 rounded-2xl text-center transition-all duration-200 hover:shadow-lg`}>
                      <div className={`w-12 h-12 ${iconColors[index]} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                        {module.module.includes('english') ? (
                          <BookOpenIcon className="w-6 h-6 text-white" />
                        ) : (
                          <AcademicCapIcon className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">
                        {module.module.replace(/(\d)/, ' $1').toUpperCase()}
                      </h4>
                      <p className="text-sm text-gray-600 mb-1">
                        {module.questions.length} questions
                      </p>
                      <p className="text-sm text-gray-600 flex items-center justify-center">
                        <ClockIcon className="w-4 h-4 mr-1" />
                        {module.timeLimit} minutes
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="text-center space-y-6">
              <button
                onClick={handleStartExam}
                className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white px-12 py-4 rounded-2xl text-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Start Preview
              </button>
              
              <p className="text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-xl inline-block">
                Preview mode: Navigate through questions without saving answers
              </p>
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
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 mb-4">Loading question...</p>
            <div className="text-xs text-gray-500 mb-4 max-w-md">
              Debug info:<br/>
              Modules: {examState.modules.length}<br/>
              Current Module Index: {examState.currentModuleIndex}<br/>
              Current Module: {currentModule ? `${currentModule.module} (${currentModule.questions.length} questions)` : 'null'}<br/>
              Current Question: {currentQuestion ? 'loaded' : 'null'}<br/>
              Status: {examState.status}<br/>
              Error: {error || 'none'}
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setHasInitialized(false)
                  if (examState.exam?.id) {
                    initializeExam(examState.exam.id)
                  }
                }}
                className="block text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Having trouble? Click to retry
              </button>
              <button
                onClick={() => router.push('/admin/exams')}
                className="block text-sm text-red-600 hover:text-red-700 underline"
              >
                Return to Admin Panel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isLastQuestion = currentModule.currentQuestionIndex === currentModule.questions.length - 1
  const isLastModule = examState.currentModuleIndex === examState.modules.length - 1

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/admin/exams')}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Exit Preview
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              {examState.exam.title}
            </h1>
            <span className="text-sm text-gray-500">
              {currentModule.module.replace(/(\d)/, ' $1').toUpperCase()}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="bg-purple-500 text-white px-3 py-1.5 rounded-full text-xs font-medium">
              Preview Mode
            </div>
          </div>
        </div>
      </div>

      {/* Top Navigation for Admin Preview */}
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
        markedQuestions={getMarkedQuestions()}
        disabled={false}
        isAdminPreview={true}
        allModules={examState.modules}
        currentModuleIndex={examState.currentModuleIndex}
        onGoToModule={handleGoToModule}
        isCompact={true}
      />

      {/* Main Question Area */}
      <div className="flex-1 overflow-hidden">
        <QuestionDisplay
          question={currentQuestion}
          questionNumber={currentModule.currentQuestionIndex + 1}
          totalQuestions={currentModule.questions.length}
          userAnswer={currentAnswer}
          onAnswerChange={handleAnswerChange}
          disabled={false}
          isAdminPreview={true}
          onQuestionUpdate={handleQuestionUpdate}
          isMarkedForReview={isMarkedForReview()}
          onToggleMarkForReview={() => toggleMarkForReview()}
        />
      </div>
    </div>
  )
}

export default function AdminExamPreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin preview...</p>
        </div>
      </div>
    }>
      <AdminExamPreviewContent />
    </Suspense>
  )
}