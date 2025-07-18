'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../../contexts/auth-context'
import { useExamState } from '../../../../hooks/use-exam-state'
import { ExamService, type Question } from '../../../../lib/exam-service'
import { ExamTimer } from '../../../../components/exam/exam-timer'
import { QuestionDisplay } from '../../../../components/exam/question-display'
import { ExamNavigation } from '../../../../components/exam/exam-navigation'
import { Navigation } from '../../../../components/navigation'
import { BulkEditPanel } from '../../../../components/exam/bulk-edit-panel'

function ExamPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading, isAdmin } = useAuth()
  const examId = params.examId as string
  const previewParam = searchParams.get('preview') === 'true'
  const isPreviewMode = previewParam && isAdmin
  
  // Debug logging for preview mode issues
  console.log('🔍 ExamPage Debug:', {
    examId,
    previewParam,
    isAdmin,
    user: user?.email,
    userProfile: user?.profile,
    userRole: user?.profile?.role,
    authLoading,
    isPreviewMode,
    hasUser: !!user,
    hasProfile: !!user?.profile,
    timestamp: new Date().toISOString()
  })
  
  // Debug preview mode
  if (previewParam && !authLoading) {
    console.log('🔍 PREVIEW MODE:', {
      isAdmin,
      role: user?.profile?.role,
      examId,
      isPreviewMode
    })
  }

  // Handle invalid examId - but only after auth is loaded
  if (!examId || examId === 'null' || examId === 'undefined') {
    if (!authLoading) {
      // If in preview mode, redirect to admin panel instead of student dashboard
      if (previewParam && isAdmin) {
        router.push('/admin/exams')
      } else {
        router.push('/student/dashboard')
      }
      return <div>Redirecting...</div>
    } else {
      // Still loading auth, show loading state
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    }
  }

  const {
    examState,
    loading,
    error,
    initializeExam,
    startExam,
    setLocalAnswer,
    saveModuleAnswers,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    goToModuleAndQuestion,
    updateQuestionInState,
    nextModule,
    completeExam,
    handleTimeExpired: handleTimeExpiredFromHook,
    updateTimer,
    getCurrentQuestion,
    getCurrentAnswer,
    toggleMarkForReview,
    isMarkedForReview,
    getMarkedQuestions,
    continueExistingAttempt,
    discardAndStartNew,
    closeConflictModal,
    forceCleanup
  } = useExamState()

  const [showStartScreen, setShowStartScreen] = useState(true)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [isUserSelecting, setIsUserSelecting] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [showTimeExpiredModal, setShowTimeExpiredModal] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const forcingExitRef = useRef(false)
  const timeExpiredRef = useRef(false)
  const isAdvancingModuleRef = useRef(false)
  const isExitingRef = useRef(false)

  // Initialize exam when component mounts
  useEffect(() => {
    // If we're in the middle of exiting, don't initialize
    if (isExitingRef.current || forcingExitRef.current) {
      console.log('🚪 ExamPage useEffect: Exiting in progress, skipping initialization')
      return
    }
    
    console.log('ExamPage useEffect: Checking initialization conditions', {
      authLoading,
      user: !!user,
      examId,
      hasInitialized,
      loading,
      previewParam,
      isAdmin,
      isPreviewMode,
      userProfile: user?.profile,
      shouldInitialize: !authLoading && examId && !hasInitialized && !loading && ((user && !previewParam) || isPreviewMode)
    })
    
    // Don't do anything if auth is still loading
    if (authLoading) {
      console.log('⏳ Auth still loading, waiting...')
      return
    }
    
    // If we have a user but no profile yet, wait for profile to load
    // (This prevents premature redirects for admin users whose profile hasn't loaded)
    if (user && !user.profile && previewParam) {
      console.log('⏳ User found but profile not loaded yet, waiting for admin check...')
      return
    }
    
    // For preview mode: need admin user with loaded profile
    // For regular mode: need any user
    const canInitialize = examId && !hasInitialized && !loading && 
      ((previewParam && isAdmin) || (!previewParam && user))
    
    if (canInitialize) {
      console.log('🚀 ExamPage useEffect: Starting exam initialization', { isPreviewMode })
      setHasInitialized(true)
      initializeExam(examId, isPreviewMode)
    } else if (!authLoading && !user && !previewParam) {
      // Not authenticated and not preview mode - redirect to dashboard
      console.log('❌ Not authenticated, redirecting to dashboard')
      router.push('/student/dashboard')
    } else if (!authLoading && user && user.profile && previewParam && !isAdmin) {
      // Preview mode with loaded profile but not admin - redirect to admin panel
      console.log('❌ Preview mode but not admin (profile loaded), redirecting to admin panel')
      router.push('/admin/exams')
    } else {
      // Log why we're not initializing
      console.log('⏳ Not ready to initialize yet:', {
        authLoading,
        hasUser: !!user,
        hasProfile: !!user?.profile,
        previewParam,
        isAdmin,
        canInitialize
      })
    }
  }, [authLoading, user, examId, hasInitialized, loading, initializeExam, isAdmin, previewParam, isPreviewMode, router])

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
    await startExam(isPreviewMode)
    setShowStartScreen(false)
  }

  // Hide start screen when continuing existing attempt or when exam is already in progress
  useEffect(() => {
    if (examState.status === 'in_progress') {
      setShowStartScreen(false)
    }
  }, [examState.status])

  // Handle answer change
  const handleAnswerChange = (answer: string) => {
    // Prevent input if time has expired
    if (timeExpiredRef.current) {
      return
    }
    
    setIsUserSelecting(true)
    setCurrentAnswer(answer)
    
    // Store answer locally only - not saved to database until module completion
    setLocalAnswer(answer, isPreviewMode)
    
    // Clear the flag after a short delay to allow answer loading on navigation
    setTimeout(() => setIsUserSelecting(false), 100)
  }

  // Save current answer locally before navigation
  const saveCurrentAnswer = () => {
    if (currentAnswer.trim()) {
      setLocalAnswer(currentAnswer, isPreviewMode)
    }
  }

  // Handle question updates during admin preview
  const handleQuestionUpdate = (updatedQuestion: Question) => {
    // Update the question in the cached exam state so it persists during navigation
    updateQuestionInState(updatedQuestion)
    console.log('✅ Question updated in database and state:', updatedQuestion.id)
  }

  // Handle bulk questions update
  const handleBulkQuestionsUpdate = async (updatedQuestions: Question[]) => {
    try {
      // Update each question in the database
      const updatePromises = updatedQuestions.map(question => 
        ExamService.updateQuestion(question.id, {
          question_text: question.question_text,
          explanation: question.explanation,
          difficulty_level: question.difficulty_level,
          question_type: question.question_type
        })
      )
      
      await Promise.all(updatePromises)
      
      // Update the questions in state
      updatedQuestions.forEach(updatedQuestion => {
        updateQuestionInState(updatedQuestion)
      })
      
      console.log('✅ Bulk questions updated successfully')
    } catch (error) {
      console.error('❌ Bulk update failed:', error)
      throw error
    }
  }

  // Handle timer expiration with popup notification
  const handleTimeExpired = useCallback(async () => {
    console.log('Timer expired! Current module:', examState.currentModuleIndex, 'Total modules:', examState.modules.length)
    
    // Set flag to prevent further input
    timeExpiredRef.current = true
    
    // Show notification popup
    setShowTimeExpiredModal(true)
    
    // Use a more reliable approach with useEffect instead of setTimeout
    // The actual advance will be handled by a separate useEffect
  }, [examState.currentModuleIndex, examState.modules.length])

  // Handle the actual module advancement when time expires
  useEffect(() => {
    if (showTimeExpiredModal && !isAdvancingModuleRef.current) {
      const timer = setTimeout(async () => {
        console.log('Auto-advancing to next module...')
        isAdvancingModuleRef.current = true
        setShowTimeExpiredModal(false)
        
        try {
          // Call the original handler from hook
          await handleTimeExpiredFromHook(isPreviewMode)
          console.log('Successfully advanced module')
          
          // Navigate to results if exam is complete
          if (examState.currentModuleIndex >= examState.modules.length - 1) {
            console.log('Exam complete, navigating to results')
            router.push('/student/results')
          }
        } catch (error) {
          console.error('Error advancing module:', error)
        }
        
        // Reset flags for next module
        timeExpiredRef.current = false
        isAdvancingModuleRef.current = false
      }, 1500) // 1.5 second delay to show notification
      
      return () => clearTimeout(timer)
    }
  }, [showTimeExpiredModal, handleTimeExpiredFromHook, examState.currentModuleIndex, examState.modules.length, router])

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
    if (!isPreviewMode) return // Only allow in preview mode
    
    saveCurrentAnswer()
    setIsUserSelecting(false)
    
    console.log('Admin navigation to module:', moduleIndex, 'question:', questionIndex)
    goToModuleAndQuestion(moduleIndex, questionIndex)
  }

  // Handle next question
  const handleNext = () => {
    saveCurrentAnswer()
    setIsUserSelecting(false)
    nextQuestion()
  }

  // Handle module completion
  const handleSubmitModule = async () => {
    saveCurrentAnswer()
    try {
      await nextModule(isPreviewMode)
    } catch (error) {
      console.error('Failed to submit module:', error)
      // Show error to user or handle accordingly
    }
  }

  // Handle exam completion
  const handleSubmitExam = async () => {
    saveCurrentAnswer()
    try {
      await completeExam()
      if (isPreviewMode) {
        console.log('Preview mode: exam completed, redirecting to admin panel')
        router.push('/admin/exams')
      } else {
        router.push('/student/results')
      }
    } catch (error) {
      console.error('Failed to complete exam:', error)
      // Show error to user or handle accordingly
    }
  }

  // Handle browser navigation/refresh/close attempts
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (examState.status === 'in_progress' && !forcingExitRef.current) {
        e.preventDefault()
        e.returnValue = 'You have an exam in progress. Your answers will be lost if you leave. Are you sure?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [examState.status])

  // Cleanup effect when component unmounts during forced exit
  useEffect(() => {
    return () => {
      if (forcingExitRef.current) {
        // Clean up exam state when component unmounts during forced exit
        forceCleanup()
      }
    }
  }, [forceCleanup])

  // Handle back navigation from Navigation component
  const handleExitAttempt = () => {
    console.log('🚪 handleExitAttempt: Exit attempt initiated, exam status:', examState.status)
    if (examState.status === 'in_progress') {
      console.log('🚪 handleExitAttempt: Showing exit confirmation modal')
      setShowExitConfirm(true)
    } else {
      console.log('🚪 handleExitAttempt: Exam not in progress, navigating directly')
      forcingExitRef.current = true
      isExitingRef.current = true
      window.location.replace('/student/dashboard')
    }
  }

  const handleConfirmExit = async () => {
    // Prevent multiple executions
    if (isExitingRef.current) {
      console.log('🚪 handleConfirmExit: Already exiting, ignoring duplicate call')
      return
    }
    
    console.log('🚪 handleConfirmExit: Starting exit process')
    isExitingRef.current = true
    setShowExitConfirm(false)
    
    // Set flag to prevent beforeunload interference IMMEDIATELY
    forcingExitRef.current = true
    
    // Save current progress before exiting
    console.log('🚪 handleConfirmExit: Saving current progress...')
    
    try {
      // Save current answer if there is one
      if (currentAnswer && currentAnswer.trim()) {
        console.log('🚪 handleConfirmExit: Saving current answer')
        setLocalAnswer(currentAnswer, isPreviewMode)
      }
      
      // Save all answers for the current module
      if (examState.attempt && examState.status === 'in_progress') {
        console.log('🚪 handleConfirmExit: Saving module answers')
        await saveModuleAnswers()
        
        // Update exam status to expired but keep progress
        console.log('🚪 handleConfirmExit: Updating exam status to expired')
        await ExamService.updateTestAttempt(examState.attempt.id, {
          status: 'expired'
          // Don't update current_module or current_question_number to preserve progress
        })
        
        console.log('🚪 handleConfirmExit: Progress saved successfully')
      }
    } catch (error) {
      console.error('🚪 handleConfirmExit: Error saving progress:', error)
      // Continue with exit even if save fails
    }
    
    // Navigate to dashboard
    console.log('🚪 handleConfirmExit: Navigating to dashboard')
    window.location.replace('/student/dashboard')
  }

  const handleCancelExit = () => {
    setShowExitConfirm(false)
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

  // Show conflict modal FIRST if there's an existing attempt
  if (examState.showConflictModal && examState.existingAttempt && examState.exam) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {examState.existingAttempt.status === 'expired' ? 'Previous Exam Attempt Found' : 'Existing Exam Attempt Found'}
              </h3>
              <p className="text-gray-600 mb-4">
                {examState.existingAttempt.status === 'expired' 
                  ? 'You have a previous exam attempt that was not completed. You can continue from where you left off or start fresh:'
                  : 'You already have an ongoing exam attempt for this test. You can either:'
                }
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-blue-900 mb-2">Current attempt details:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Status: {examState.existingAttempt.status.replace('_', ' ').toUpperCase()}</li>
                  <li>• Current Module: {examState.existingAttempt.current_module?.replace(/(\d)/, ' $1').toUpperCase()}</li>
                  {examState.existingAttempt.started_at && (
                    <li>• Started: {new Date(examState.existingAttempt.started_at).toLocaleString()}</li>
                  )}
                </ul>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={continueExistingAttempt}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                  disabled={loading}
                >
                  {loading ? 'Loading...' : (examState.existingAttempt.status === 'expired' ? 'Continue from Previous Attempt' : 'Continue Existing Attempt')}
                </button>
                <button
                  onClick={discardAndStartNew}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                  disabled={loading}
                >
                  {loading ? 'Loading...' : 'Discard & Start New'}
                </button>
              </div>
              <button
                onClick={() => closeConflictModal(router)}
                className="w-full mt-3 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
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
    console.log('🚨 EXAM ERROR DETECTED:', error)
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-600 text-xl mb-4">Error loading exam</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="text-xs text-gray-500 mb-4">
              Preview Mode: {isPreviewMode ? 'Yes' : 'No'}<br/>
              Admin: {isAdmin ? 'Yes' : 'No'}<br/>
              Exam ID: {examId}
            </div>
            <button
              onClick={() => {
                console.log('🔄 Redirecting from error state to:', isPreviewMode ? '/admin/exams' : '/student/dashboard')
                router.push(isPreviewMode ? '/admin/exams' : '/student/dashboard')
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Return to {isPreviewMode ? 'Admin Panel' : 'Dashboard'}
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
            {isPreviewMode && (
              <div className="mb-4 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-orange-800 font-medium">🔍 Admin Preview Mode</span>
                  <button
                    onClick={() => router.push('/admin/exams')}
                    className="text-orange-600 hover:text-orange-800 text-sm underline"
                  >
                    ← Back to Admin Panel
                  </button>
                </div>
              </div>
            )}
            
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

            <div className="text-center space-y-4">
              <button
                onClick={handleStartExam}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-colors"
              >
                {isPreviewMode ? 'Preview Exam' : 'Start Exam'}
              </button>
              
              {isPreviewMode && (
                <p className="text-sm text-gray-600">
                  Preview mode: Navigate through questions without saving answers
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main exam interface
  const currentModule = examState.modules[examState.currentModuleIndex]
  const currentQuestion = getCurrentQuestion()
  
  // Debug logging - only when needed for debugging
  // console.log('Debug exam state:', {
  //   examStateStatus: examState.status,
  //   modulesLength: examState.modules.length,
  //   currentModuleIndex: examState.currentModuleIndex,
  //   currentModule: currentModule ? {
  //     module: currentModule.module,
  //     questionsLength: currentModule.questions.length,
  //     currentQuestionIndex: currentModule.currentQuestionIndex
  //   } : null,
  //   currentQuestion: currentQuestion ? {
  //     id: currentQuestion.id,
  //     questionNumber: currentQuestion.question_number
  //   } : null,
  //   attempt: examState.attempt ? {
  //     id: examState.attempt.id,
  //     status: examState.attempt.status
  //   } : null
  // })
  
  if (!currentModule || !currentQuestion) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
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
                  console.log('Retry clicked, resetting...')
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
                onClick={() => router.push('/student/dashboard')}
                className="block text-sm text-red-600 hover:text-red-700 underline"
              >
                Return to Dashboard
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
      {/* Header with Timer */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        {isPreviewMode && (
          <div className="mb-3 p-2 bg-orange-100 border border-orange-300 rounded text-center">
            <span className="text-orange-800 text-sm font-medium">
              🔍 Admin Preview Mode - Changes will not be saved
            </span>
            <button
              onClick={() => router.push('/admin/exams')}
              className="ml-4 text-orange-600 hover:text-orange-800 text-xs underline"
            >
              Back to Admin Panel
            </button>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleExitAttempt}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← {isPreviewMode ? 'Exit Preview' : 'Exit Exam'}
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              {examState.exam.title}
            </h1>
            <span className="text-sm text-gray-500">
              {currentModule.module.replace(/(\d)/, ' $1').toUpperCase()}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            {!isPreviewMode && (
              <ExamTimer
                initialTimeSeconds={currentModule.timeRemaining}
                onTimeExpired={handleTimeExpired}
                onTimeUpdate={updateTimer}
                isPaused={examState.status !== 'in_progress' || showTimeExpiredModal}
              />
            )}
            {isPreviewMode && (
              <span className="text-sm text-orange-600 font-medium">
                Preview Mode - No Timer
              </span>
            )}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={() => {
                  console.log('Test button clicked - simulating timer expiry')
                  handleTimeExpired()
                }}
                className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
              >
                Test Timer Expiry
              </button>
            )}
          </div>
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
          disabled={examState.status !== 'in_progress' || timeExpiredRef.current}
          isAdminPreview={isPreviewMode}
          onQuestionUpdate={handleQuestionUpdate}
          isMarkedForReview={isMarkedForReview()}
          onToggleMarkForReview={toggleMarkForReview}
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
        markedQuestions={getMarkedQuestions()}
        disabled={examState.status !== 'in_progress' || timeExpiredRef.current}
        isAdminPreview={isPreviewMode}
        allModules={examState.modules}
        currentModuleIndex={examState.currentModuleIndex}
        onGoToModule={handleGoToModule}
      />

      {/* Time Expired Modal */}
      {showTimeExpiredModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 border-2 border-red-200">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-red-700 mb-2">
                Time's Up!
              </h3>
              <p className="text-gray-600 mb-4">
                {examState.currentModuleIndex < examState.modules.length - 1 
                  ? `${currentModule.module.replace(/(\d)/, ' $1').toUpperCase()} time has expired. Moving to the next module...`
                  : 'Exam time has expired. Submitting your answers...'}
              </p>
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Exit Exam?
            </h3>
            <p className="text-gray-600 mb-6">
              You have an exam in progress. If you exit now, your current answers will be lost and will not be saved until you complete the current module.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={handleCancelExit}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition-colors"
              >
                Continue Exam
              </button>
              <button
                onClick={(e) => {
                  console.log('🚪 Exit Anyway button clicked')
                  e.preventDefault()
                  e.stopPropagation()
                  handleConfirmExit()
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Exit Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Panel - Only in Preview Mode */}
      {isPreviewMode && (
        <BulkEditPanel
          questions={currentModule.questions}
          moduleType={currentModule.module}
          onQuestionsUpdate={handleBulkQuestionsUpdate}
          isVisible={showBulkEdit}
          onToggle={() => setShowBulkEdit(!showBulkEdit)}
        />
      )}

    </div>
  )
}

export default function ExamPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading exam...</p>
        </div>
      </div>
    }>
      <ExamPageContent />
    </Suspense>
  )
}