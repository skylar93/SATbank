'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../../../contexts/auth-context'
import { useExamStore } from '../../../../../store/exam-store'
import { ExamService } from '../../../../../lib/exam-service'
import { ExamTimer } from '../../../../../components/exam/exam-timer'
import { QuestionDisplay } from '../../../../../components/exam/question-display'
import { ExamNavigation } from '../../../../../components/exam/exam-navigation'
import { ReferenceSheetModal } from '../../../../../components/exam/ReferenceSheetModal'
import { TimeExpiredOverlay } from '../../../../../components/exam/TimeExpiredOverlay'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../../../components/ui/dialog'
import { Button } from '../../../../../components/ui/button'
import { Card, CardContent } from '../../../../../components/ui/card'
import {
  AcademicCapIcon,
  BookOpenIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

function ExamPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const examId = params.examId as string

  // Get state and actions from Zustand store (must be called before any returns)
  const {
    // State
    exam,
    attempt,
    modules,
    currentModuleIndex,
    status,
    existingAttempt,
    showConflictModal,
    loading,
    error,
    highlightsByQuestion,
    // Actions
    initializeExam,
    startExam,
    setLocalAnswer,
    saveModuleAnswers,
    nextQuestion,
    previousQuestion,
    goToQuestion,
    nextModule,
    completeExam,
    completeReviewSession,
    timeExpired,
    handleTimeExpired: handleTimeExpiredFromHook,
    updateTimer,
    getCurrentQuestion,
    toggleMarkForReview,
    isMarkedForReview,
    getMarkedQuestions,
    continueExistingAttempt,
    discardAndStartNew,
    closeConflictModal,
    forceCleanup,
    addHighlight,
    removeHighlight,
    saveCurrentAnswerImmediately,
  } = useExamStore()

  const [showStartScreen, setShowStartScreen] = useState(true)
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [isUserSelecting, setIsUserSelecting] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)
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
  const questionContentRef = useRef<HTMLDivElement>(null)

  // Reset initialization flag when examId changes
  useEffect(() => {
    console.log('🔄 ExamId changed, resetting initialization flag:', {
      examId,
      hasInitialized,
    })
    setHasInitialized(false)
  }, [examId])
  const forcingExitRef = useRef(false)
  const timeExpiredRef = useRef(false)
  const isAdvancingModuleRef = useRef(false)
  const isExitingRef = useRef(false)

  // Get exam answer check mode
  useEffect(() => {
    if (examId && !authLoading) {
      ExamService.getExamAnswerMode(examId)
        .then((mode) => setAnswerCheckMode(mode))
        .catch((error) =>
          console.error('Error getting answer check mode:', error)
        )
    }
  }, [examId, authLoading])

  // Initialize exam when component mounts
  useEffect(() => {
    // If we're in the middle of exiting, don't initialize
    if (isExitingRef.current || forcingExitRef.current) {
      console.log(
        '🚪 ExamPage useEffect: Exiting in progress, skipping initialization'
      )
      return
    }

    // Check for review mode
    const reviewForAttemptId = searchParams.get('review_for')

    console.log('ExamPage useEffect: Checking initialization conditions', {
      authLoading,
      user: !!user,
      examId,
      hasInitialized,
      loading,
      userProfile: user?.profile,
      reviewForAttemptId,
      shouldInitialize:
        !authLoading && user && examId && !hasInitialized && !loading,
    })

    // Don't do anything if auth is still loading
    if (authLoading) {
      console.log('⏳ Auth still loading, waiting...')
      return
    }

    // For student mode: need authenticated user
    const canInitialize = examId && !hasInitialized && !loading && user

    if (canInitialize && user) {
      console.log(
        `🚀 ExamPage useEffect: Starting exam initialization ${reviewForAttemptId ? '(Review Mode)' : '(Normal Mode)'}`
      )
      setHasInitialized(true)
      initializeExam(examId, user.id, reviewForAttemptId || undefined)
    } else if (!authLoading && !user) {
      // Not authenticated - redirect to dashboard
      console.log('❌ Not authenticated, redirecting to dashboard')
      router.push('/student/dashboard')
    } else {
      // Log why we're not initializing
      console.log('⏳ Not ready to initialize yet:', {
        authLoading,
        hasUser: !!user,
        hasProfile: !!user?.profile,
        canInitialize,
      })
    }
  }, [
    authLoading,
    user,
    examId,
    hasInitialized,
    loading,
    initializeExam,
    router,
    searchParams, // Add searchParams as dependency
  ])

  // Update current answer when question changes (but not when user is actively selecting)
  useEffect(() => {
    if (modules.length > 0 && !isUserSelecting) {
      const currentModule = modules[currentModuleIndex]
      if (currentModule) {
        const currentQuestion =
          currentModule.questions[currentModule.currentQuestionIndex]
        if (currentQuestion) {
          const existingAnswer =
            currentModule.answers[currentQuestion.id]?.answer
          setCurrentAnswer(existingAnswer || '')
        }
      }
    }
  }, [
    modules,
    currentModuleIndex,
    modules[currentModuleIndex]?.currentQuestionIndex,
    isUserSelecting,
  ])

  // Handle exam start
  const handleStartExam = async () => {
    await startExam()
    setShowStartScreen(false)
  }

  // Hide start screen when continuing existing attempt or when exam is already in progress
  useEffect(() => {
    if (status === 'in_progress') {
      setShowStartScreen(false)
    }
  }, [status])

  // Handle answer change
  const handleAnswerChange = async (answer: string) => {
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
  }

  // Handle checking answer in per-question mode
  const handleCheckAnswer = async () => {
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
  }

  // Handle timer expiration with immediate state change
  const handleTimeExpired = useCallback(() => {
    console.log(
      'Timer expired! Current module:',
      currentModuleIndex,
      'Total modules:',
      modules.length
    )

    // Set flag to prevent further input
    timeExpiredRef.current = true

    // Immediately set time_expired status - no delay
    timeExpired()
  }, [timeExpired, currentModuleIndex, modules.length])

  // Handle the actual module advancement when status changes to time_expired
  useEffect(() => {
    if (status === 'time_expired' && !isAdvancingModuleRef.current) {
      isAdvancingModuleRef.current = true
      console.log('Status changed to time_expired, advancing module...')

      const advanceModule = async () => {
        try {
          // Small delay to show the "Time's Up" message briefly
          await new Promise((resolve) => setTimeout(resolve, 1500))

          console.log('Calling handleTimeExpiredFromHook...')
          await handleTimeExpiredFromHook()
          console.log('Successfully advanced module')

          // Navigate to results if exam is complete
          if (currentModuleIndex >= modules.length - 1) {
            console.log('Exam complete, navigating to results')
            router.push('/student/results')
          }
        } catch (error) {
          console.error('Error advancing module:', error)
        } finally {
          // Reset flags for next module
          timeExpiredRef.current = false
          isAdvancingModuleRef.current = false
        }
      }

      advanceModule()
    }
  }, [
    status,
    handleTimeExpiredFromHook,
    currentModuleIndex,
    modules.length,
    router,
  ])

  // Handle previous question
  const handlePrevious = async () => {
    await saveCurrentAnswerImmediately() // Save immediately before navigation
    setIsUserSelecting(false)
    previousQuestion()
  }

  // Handle go to specific question
  const handleGoToQuestion = async (questionIndex: number) => {
    await saveCurrentAnswerImmediately() // Save immediately before navigation
    setIsUserSelecting(false)
    goToQuestion(questionIndex)
  }

  // Handle next question
  const handleNext = async () => {
    await saveCurrentAnswerImmediately() // Save immediately before navigation
    setIsUserSelecting(false)
    nextQuestion()
  }

  // Handle module completion
  const handleSubmitModule = async () => {
    await saveCurrentAnswerImmediately() // Save immediately before module completion
    try {
      await nextModule()
    } catch (error) {
      console.error('Failed to submit module:', error)
      // Show error to user or handle accordingly
    }
  }

  // Handle exam completion
  const handleSubmitExam = async () => {
    console.log('📝 Submitting exam...')

    await saveCurrentAnswerImmediately() // Save immediately before exam completion

    // Check if this is review mode (no actual attempt record)
    const reviewForAttemptId = searchParams.get('review_for')

    try {
      if (reviewForAttemptId) {
        // Review mode - calculate potential score and show modal
        console.log('🎯 Completing review session')
        await completeReviewSession(reviewForAttemptId)

        // Redirect directly to the second-chance-review page (no popup needed)
        router.push(
          `/student/results/${reviewForAttemptId}/second-chance-review`
        )
      } else {
        // Normal exam mode
        await completeExam()
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
      if (status === 'in_progress' && !forcingExitRef.current) {
        // Try to save current answer immediately (synchronous attempt)
        saveCurrentAnswerImmediately().catch(console.error)

        // Note: With real-time saving, answers are mostly already saved,
        // so this message is now more accurate
        e.preventDefault()
        e.returnValue =
          'You have an exam in progress. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [status, saveCurrentAnswerImmediately])

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
    console.log(
      '🚪 handleExitAttempt: Exit attempt initiated, exam status:',
      status
    )
    if (status === 'in_progress') {
      console.log('🚪 handleExitAttempt: Showing exit confirmation modal')
      setShowExitConfirm(true)
    } else {
      console.log(
        '🚪 handleExitAttempt: Exam not in progress, navigating directly'
      )
      forcingExitRef.current = true
      isExitingRef.current = true
      window.location.replace('/student/dashboard')
    }
  }

  const handleConfirmExit = async () => {
    // Prevent multiple executions
    if (isExitingRef.current) {
      console.log(
        '🚪 handleConfirmExit: Already exiting, ignoring duplicate call'
      )
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
        setLocalAnswer(currentAnswer)
      }

      // Save all answers for the current module
      if (attempt && status === 'in_progress') {
        console.log('🚪 handleConfirmExit: Saving module answers')
        await saveModuleAnswers()

        // Update exam status to expired but keep progress
        console.log('🚪 handleConfirmExit: Updating exam status to expired')
        await ExamService.updateTestAttempt(attempt.id, {
          status: 'expired',
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

  // Handle answer reveal continue
  const handleAnswerRevealContinue = () => {
    // If this was an incorrect answer, show correct answer before continuing
    // This happens when they click "Skip & Continue"
    if (answerRevealData && !answerRevealData.isCorrect) {
      setShouldShowCorrectAnswer(true)
      // Give a moment to see the correct answer before moving on
      setTimeout(() => {
        proceedToNextQuestion()
      }, 2000) // 2 second delay to show correct answer
    } else {
      proceedToNextQuestion()
    }
  }

  const proceedToNextQuestion = () => {
    setShowAnswerReveal(false)
    setAnswerRevealData(null)
    setShouldShowCorrectAnswer(false)

    // Move to next question
    const currentModule = modules[currentModuleIndex]
    if (currentModule) {
      const currentQuestionIndex = currentModule.questions.findIndex(
        (q) => q.id === getCurrentQuestion()?.id
      )

      if (currentQuestionIndex < currentModule.questions.length - 1) {
        nextQuestion()
      } else {
        // Last question in module - advance to next module or complete exam
        if (currentModuleIndex < modules.length - 1) {
          nextModule()
        } else {
          completeExam()
        }
      }
    }
  }

  // Handle try again - reset answer submission state so student can try again
  const handleTryAgain = () => {
    setShowAnswerReveal(false)
    setAnswerRevealData(null)
    setShouldShowCorrectAnswer(false)
    // Keep the current answer so they can modify it and try again
  }

  // Get answered questions for current module
  const getAnsweredQuestions = () => {
    const currentModule = modules[currentModuleIndex]
    if (!currentModule) return new Set<number>()

    const answeredSet = new Set<number>()
    currentModule.questions.forEach((question, index) => {
      const answer = currentModule.answers[question.id]
      if (answer && answer.answer && answer.answer.trim() !== '') {
        answeredSet.add(index + 1) // Convert to 1-based indexing
      }
    })
    return answeredSet
  }

  // Show conflict modal FIRST if there's an existing attempt
  if (showConflictModal && existingAttempt && exam) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <Dialog
            open={showConflictModal}
            onOpenChange={() => closeConflictModal(router)}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {existingAttempt.status === 'expired'
                    ? 'Previous Exam Attempt Found'
                    : 'Existing Exam Attempt Found'}
                </DialogTitle>
                <DialogDescription>
                  {existingAttempt.status === 'expired'
                    ? 'You have a previous exam attempt that was not completed. You can continue from where you left off or start fresh.'
                    : 'You already have an ongoing exam attempt for this test. You can either:'}
                </DialogDescription>
              </DialogHeader>

              <Card>
                <CardContent className="pt-6">
                  <h4 className="font-medium text-sm text-foreground mb-3">
                    Current attempt details:
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Status:{' '}
                      <span className="font-medium">
                        {existingAttempt.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Current Module:{' '}
                      <span className="font-medium">
                        {existingAttempt.current_module
                          ?.replace(/(\d)/, ' $1')
                          .toUpperCase()}
                      </span>
                    </li>
                    {existingAttempt.started_at && (
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                        Started:{' '}
                        <span className="font-medium">
                          {new Date(
                            existingAttempt.started_at
                          ).toLocaleString()}
                        </span>
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>

              <DialogFooter className="flex-col sm:flex-col gap-2">
                <Button
                  onClick={continueExistingAttempt}
                  disabled={loading}
                  size="lg"
                  className="w-full"
                >
                  {loading
                    ? 'Loading...'
                    : existingAttempt.status === 'expired'
                      ? 'Continue from Previous Attempt'
                      : 'Continue Existing Attempt'}
                </Button>
                <Button
                  onClick={() => user && discardAndStartNew(user.id)}
                  disabled={loading}
                  variant="destructive"
                  size="lg"
                  className="w-full"
                >
                  {loading ? 'Loading...' : 'Discard & Start New'}
                </Button>
                <Button
                  onClick={() => closeConflictModal(router)}
                  disabled={loading}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    )
  }

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
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
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-red-600 text-xl mb-4">Error loading exam</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="text-xs text-gray-500 mb-4">Exam ID: {examId}</div>
            <button
              onClick={() => {
                console.log('🔄 Redirecting from error state to dashboard')
                router.push('/student/dashboard')
              }}
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
  if (!exam) {
    return (
      <div className="min-h-screen bg-gray-50">
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
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AcademicCapIcon className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {exam.title}
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {exam.description}
              </p>
            </div>

            <div className="mb-8">
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-6 mb-8">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center">
                    <BookOpenIcon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-violet-800">
                    Exam Instructions
                  </h3>
                </div>
                <ul className="space-y-3 text-violet-700">
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                    <span>
                      This exam consists of 4 modules: English 1, English 2,
                      Math 1, Math 2
                    </span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                    <span>Each module has a strict time limit</span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                    <span>
                      You cannot return to previous questions or modules
                    </span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                    <span>
                      Answer all questions to the best of your ability
                    </span>
                  </li>
                  <li className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                    <span>The exam will auto-submit when time expires</span>
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {modules.map((module, index) => {
                  const colors = [
                    'from-indigo-50 to-indigo-100 border-indigo-200',
                    'from-violet-50 to-violet-100 border-violet-200',
                    'from-purple-50 to-purple-100 border-purple-200',
                    'from-pink-50 to-pink-100 border-pink-200',
                  ]
                  const iconColors = [
                    'bg-indigo-500',
                    'bg-violet-500',
                    'bg-purple-500',
                    'bg-pink-500',
                  ]
                  const hoverColors = [
                    'hover:from-indigo-100 hover:to-indigo-200',
                    'hover:from-violet-100 hover:to-violet-200',
                    'hover:from-purple-100 hover:to-purple-200',
                    'hover:from-pink-100 hover:to-pink-200',
                  ]

                  return (
                    <div
                      key={module.module}
                      className={`bg-gradient-to-r ${colors[index]} border ${hoverColors[index]} p-6 rounded-2xl text-center transition-all duration-200 hover:shadow-lg`}
                    >
                      <div
                        className={`w-12 h-12 ${iconColors[index]} rounded-xl flex items-center justify-center mx-auto mb-4`}
                      >
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
                Start Exam
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main exam interface
  const currentModule = modules[currentModuleIndex]
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
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 mb-4">Loading question...</p>
            <div className="text-xs text-gray-500 mb-4 max-w-md">
              Debug info:
              <br />
              Modules: {modules.length}
              <br />
              Current Module Index: {currentModuleIndex}
              <br />
              Current Module:{' '}
              {currentModule
                ? `${currentModule.module} (${currentModule.questions.length} questions)`
                : 'null'}
              <br />
              Current Question: {currentQuestion ? 'loaded' : 'null'}
              <br />
              Status: {status}
              <br />
              Error: {error || 'none'}
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  console.log('Retry clicked, resetting...')
                  setHasInitialized(false)
                  if (exam?.id && user) {
                    initializeExam(exam.id, user.id)
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

  // Handle invalid examId
  if (!examId || examId === 'null' || examId === 'undefined') {
    if (!authLoading) {
      router.push('/student/dashboard')
      return <div>Redirecting...</div>
    } else {
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

  const isLastQuestion =
    currentModule.currentQuestionIndex === currentModule.questions.length - 1
  const isLastModule = currentModuleIndex === modules.length - 1

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header with Timer */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleExitAttempt}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Exit Exam
            </button>
            <ReferenceSheetModal />
            <h1 className="text-xl font-semibold text-gray-900">
              {exam.title}
            </h1>
            <span className="text-sm text-gray-500">
              {(() => {
                const reviewForAttemptId = searchParams.get('review_for')
                if (reviewForAttemptId && currentQuestion) {
                  // In review mode, show the actual module type of the current question
                  return `${currentQuestion.module_type.replace(/(\d)/, ' $1').toUpperCase()} (Review)`
                } else {
                  // Normal mode, show the current module
                  return currentModule.module
                    .replace(/(\d)/, ' $1')
                    .toUpperCase()
                }
              })()}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <ExamTimer
              initialTimeSeconds={currentModule.timeRemaining}
              onTimeExpired={handleTimeExpired}
              onTimeUpdate={updateTimer}
              isPaused={status !== 'in_progress'}
            />
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
          disabled={status !== 'in_progress' || timeExpiredRef.current}
          isAdminPreview={false}
          isMarkedForReview={isMarkedForReview()}
          onToggleMarkForReview={() => toggleMarkForReview()}
          questionContentRef={questionContentRef}
          highlights={highlightsByQuestion[currentQuestion.id] || []}
          onRemoveHighlight={(highlight) =>
            removeHighlight(currentQuestion.id, highlight)
          }
          onAddHighlight={(highlight) =>
            addHighlight(currentQuestion.id, highlight)
          }
          showPerQuestionAnswers={answerCheckMode === 'per_question'}
          isAnswerSubmitted={showAnswerReveal}
          isCorrect={answerRevealData?.isCorrect}
          onContinueAfterAnswer={handleAnswerRevealContinue}
          onCheckAnswer={handleCheckAnswer}
          onTryAgain={handleTryAgain}
          showCorrectAnswer={shouldShowCorrectAnswer}
          module={currentModule.module}
          isPaused={status !== 'in_progress' || timeExpiredRef.current}
        />
      </div>

      {/* Bottom Navigation */}
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
        disabled={status !== 'in_progress' || timeExpiredRef.current}
        isAdminPreview={false}
      />

      {/* Time Expired Overlay */}
      {status === 'time_expired' && (
        <TimeExpiredOverlay
          isLastModule={currentModuleIndex >= modules.length - 1}
        />
      )}

      {/* Exit Confirmation Modal */}
      <Dialog open={showExitConfirm} onOpenChange={handleCancelExit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exit Exam?</DialogTitle>
            <DialogDescription>
              Your progress has been automatically saved. You can resume this
              exam later from where you left off.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              onClick={handleCancelExit}
              variant="outline"
              className="w-full"
            >
              Continue Exam
            </Button>
            <Button
              onClick={(e) => {
                console.log('🚪 Exit Anyway button clicked')
                e.preventDefault()
                e.stopPropagation()
                handleConfirmExit()
              }}
              variant="destructive"
              className="w-full"
            >
              Exit Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ExamPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading exam...</p>
          </div>
        </div>
      }
    >
      <ExamPageContent />
    </Suspense>
  )
}
