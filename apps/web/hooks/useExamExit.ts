import { useRef, useCallback, useEffect } from 'react'
import { ExamService } from '../lib/exam-service'

interface UseExamExitProps {
  status: string
  attempt: any
  currentAnswer: string
  setLocalAnswer: (answer: string) => void
  saveModuleAnswers: () => Promise<void>
  forceCleanup: () => void
  openExitConfirm: () => void
  closeExitConfirm: () => void
}

export const useExamExit = ({
  status,
  attempt,
  currentAnswer,
  setLocalAnswer,
  saveModuleAnswers,
  forceCleanup,
  openExitConfirm,
  closeExitConfirm,
}: UseExamExitProps) => {
  const forcingExitRef = useRef(false)
  const isExitingRef = useRef(false)

  // Handle browser navigation/refresh/close attempts
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'in_progress' && !forcingExitRef.current) {
        e.preventDefault()
        e.returnValue =
          'You have an exam in progress. Your answers will be lost if you leave. Are you sure?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [status])

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
  const handleExitAttempt = useCallback(() => {
    console.log(
      '🚪 handleExitAttempt: Exit attempt initiated, exam status:',
      status
    )
    if (status === 'in_progress') {
      console.log('🚪 handleExitAttempt: Showing exit confirmation modal')
      openExitConfirm()
    } else {
      console.log(
        '🚪 handleExitAttempt: Exam not in progress, navigating directly'
      )
      forcingExitRef.current = true
      isExitingRef.current = true
      window.location.replace('/student/dashboard')
    }
  }, [status, openExitConfirm])

  const handleConfirmExit = useCallback(async () => {
    // Prevent multiple executions
    if (isExitingRef.current) {
      console.log(
        '🚪 handleConfirmExit: Already exiting, ignoring duplicate call'
      )
      return
    }

    console.log('🚪 handleConfirmExit: Starting exit process')
    isExitingRef.current = true
    closeExitConfirm()

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
  }, [
    isExitingRef,
    closeExitConfirm,
    currentAnswer,
    setLocalAnswer,
    attempt,
    status,
    saveModuleAnswers,
  ])

  return {
    // Refs
    forcingExitRef,
    isExitingRef,
    
    // Handlers
    handleExitAttempt,
    handleConfirmExit,
  }
}