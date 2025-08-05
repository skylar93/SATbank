'use client'

import { useState, useCallback, useEffect } from 'react'
import { ExamService, type Question, type Exam, type TestAttempt, type ModuleType } from '../lib/exam-service'
import { useAuth } from '../contexts/auth-context'
import { checkAnswer } from '../lib/answer-checker'
import { supabase } from '../lib/supabase'

interface ExamAnswer {
  questionId: string
  answer: string
  timeSpent: number // seconds spent on this question
  answeredAt: Date
}

interface ModuleState {
  module: ModuleType
  questions: Question[]
  currentQuestionIndex: number
  answers: Record<string, ExamAnswer>
  markedForReview: Set<string> // question IDs marked for review
  timeLimit: number // minutes
  timeRemaining: number // seconds
  completed: boolean
}

interface FinalScores {
  overall: number
  english: number
  math: number
}

interface ExamState {
  exam: Exam | null
  attempt: TestAttempt | null
  modules: ModuleState[]
  currentModuleIndex: number
  status: 'not_started' | 'in_progress' | 'completed' | 'expired'
  startedAt: Date | null
  existingAttempt: TestAttempt | null
  showConflictModal: boolean
  finalScores?: FinalScores // Server-calculated scaled scores
}

const MODULE_ORDER: ModuleType[] = ['english1', 'english2', 'math1', 'math2']

export function useExamState() {
  const { user } = useAuth()
  const [examState, setExamState] = useState<ExamState>({
    exam: null,
    attempt: null,
    modules: [],
    currentModuleIndex: 0,
    status: 'not_started',
    startedAt: null,
    existingAttempt: null,
    showConflictModal: false
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize exam with questions
  const initializeExam = useCallback(async (examId: string, isPreview: boolean = false) => {
    if (!user && !isPreview) {
      console.log('initializeExam: No user, skipping')
      return
    }

    console.log('initializeExam: Starting initialization for exam:', examId, 'user:', user?.email, 'preview:', isPreview)
    setLoading(true)
    setError(null)

    try {
      // Get exam details
      console.log('initializeExam: Fetching exam details...')
      const exam = await ExamService.getExam(examId)
      if (!exam) {
        console.error('initializeExam: Exam not found')
        throw new Error('Exam not found')
      }
      console.log('initializeExam: Exam found:', exam.title)

      // Check if student has access to this exam (skip for preview mode)
      if (!isPreview && user) {
        console.log('initializeExam: Checking exam access...')
        const hasAccess = await ExamService.hasExamAccess(user.id, examId)
        if (!hasAccess) {
          console.error('initializeExam: Access denied - exam not assigned to student')
          throw new Error('You do not have access to this exam. Please contact your administrator.')
        }
        console.log('initializeExam: Access granted')
      }

      let attempt = null

      if (!isPreview) {
        // Check for existing in-progress attempt BEFORE cleanup
        console.log('initializeExam: Checking for existing attempts...')
        const existingAttempt = await ExamService.getInProgressAttempt(user!.id, examId)
        
        if (existingAttempt) {
          console.log('initializeExam: Found existing attempt, showing conflict modal')
          // Show conflict modal
          setExamState(prev => ({
            ...prev,
            exam,
            existingAttempt,
            showConflictModal: true
          }))
          setLoading(false)
          return
        }

        // Clean up any duplicate attempts only after checking for valid existing attempts
        console.log('initializeExam: Cleaning up duplicate attempts...')
        await ExamService.cleanupDuplicateAttempts(user!.id, examId)

        // Create new test attempt
        console.log('initializeExam: Creating new test attempt...')
        attempt = await ExamService.createTestAttempt({
          user_id: user!.id,
          exam_id: examId,
          status: 'not_started',
          current_module: 'english1'
        })
        console.log('initializeExam: Test attempt created:', attempt.id)
      } else {
        console.log('initializeExam: Preview mode - skipping attempt creation')
      }

      // Load questions for all modules
      const moduleStates: ModuleState[] = []
      console.log('initializeExam: Loading questions for all modules...')
      
      for (const moduleType of MODULE_ORDER) {
        console.log(`initializeExam: Fetching questions for module: ${moduleType}`)
        const questions = await ExamService.getQuestions(examId, moduleType)
        const timeLimit = exam.time_limits[moduleType] || 60

        console.log(`initializeExam: Module ${moduleType} loaded ${questions.length} questions`)

        // Skip modules with no questions (don't add them to the array)
        if (questions.length === 0) {
          console.warn(`initializeExam: Skipping module ${moduleType} - no questions found`)
          continue
        }

        moduleStates.push({
          module: moduleType,
          questions,
          currentQuestionIndex: 0,
          answers: {},
          markedForReview: new Set(),
          timeLimit,
          timeRemaining: timeLimit * 60, // Convert to seconds
          completed: false
        })
      }

      console.log('initializeExam: Final module states:', moduleStates.length, 'modules loaded')

      // Ensure we have at least one module with questions
      if (moduleStates.length === 0) {
        console.error('initializeExam: No modules with questions found!')
        throw new Error('No questions found for any module in this exam')
      }

      console.log('initializeExam: Setting exam state...')
      setExamState({
        exam,
        attempt,
        modules: moduleStates,
        currentModuleIndex: 0,
        status: 'not_started',
        startedAt: null,
        existingAttempt: null,
        showConflictModal: false
      })
      console.log('initializeExam: Exam state set successfully')
    } catch (err: any) {
      console.error('initializeExam: Error occurred:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Start the exam
  const startExam = useCallback(async (isPreview: boolean = false) => {
    if (!examState.attempt && !isPreview) return

    try {
      if (!isPreview && examState.attempt) {
        await ExamService.updateTestAttempt(examState.attempt.id, {
          status: 'in_progress',
          started_at: new Date().toISOString(),
          current_module: 'english1'
        })
      }

      setExamState(prev => ({
        ...prev,
        status: 'in_progress',
        startedAt: new Date()
      }))
    } catch (err: any) {
      setError(err.message)
    }
  }, [examState.attempt])

  // Store answer locally (not saved to database until module completion)
  const setLocalAnswer = useCallback((answer: string, isPreview: boolean = false) => {
    if ((!examState.attempt && !isPreview) || (examState.status !== 'in_progress' && !isPreview)) return

    const currentModule = examState.modules[examState.currentModuleIndex]
    const currentQuestion = currentModule.questions[currentModule.currentQuestionIndex]
    
    if (!currentQuestion) return

    // Update local state only
    const examAnswer: ExamAnswer = {
      questionId: currentQuestion.id,
      answer,
      timeSpent: 0,
      answeredAt: new Date()
    }

    setExamState(prev => {
      const newModules = [...prev.modules]
      newModules[prev.currentModuleIndex] = {
        ...newModules[prev.currentModuleIndex],
        answers: {
          ...newModules[prev.currentModuleIndex].answers,
          [currentQuestion.id]: examAnswer
        }
      }

      return {
        ...prev,
        modules: newModules
      }
    })
  }, [examState])

  // Save all answers for current module to database
  const saveModuleAnswers = useCallback(async () => {
    if (!examState.attempt || examState.status !== 'in_progress') return

    const currentModule = examState.modules[examState.currentModuleIndex]
    
    try {
      // Save all answers for this module
      for (const [questionId, examAnswer] of Object.entries(currentModule.answers)) {
        const question = currentModule.questions.find(q => q.id === questionId)
        if (question && examAnswer.answer) {
          const isCorrect = checkAnswer(examAnswer.answer, question.correct_answer)
          
          await ExamService.submitAnswer({
            attempt_id: examState.attempt.id,
            question_id: questionId,
            user_answer: examAnswer.answer,
            is_correct: isCorrect,
            time_spent_seconds: examAnswer.timeSpent
          })
        }
      }
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }, [examState])

  // Move to next question
  const nextQuestion = useCallback(() => {
    setExamState(prev => {
      const currentModule = prev.modules[prev.currentModuleIndex]
      const nextQuestionIndex = currentModule.currentQuestionIndex + 1

      if (nextQuestionIndex >= currentModule.questions.length) {
        // Should not happen - use nextModule instead
        return prev
      }

      const newModules = [...prev.modules]
      newModules[prev.currentModuleIndex] = {
        ...newModules[prev.currentModuleIndex],
        currentQuestionIndex: nextQuestionIndex
      }

      return {
        ...prev,
        modules: newModules
      }
    })
  }, [])

  // Move to previous question (within same module only)
  const previousQuestion = useCallback(() => {
    setExamState(prev => {
      const currentModule = prev.modules[prev.currentModuleIndex]
      const prevQuestionIndex = currentModule.currentQuestionIndex - 1

      if (prevQuestionIndex < 0) {
        // Can't go before first question in module
        return prev
      }

      const newModules = [...prev.modules]
      newModules[prev.currentModuleIndex] = {
        ...newModules[prev.currentModuleIndex],
        currentQuestionIndex: prevQuestionIndex
      }

      return {
        ...prev,
        modules: newModules
      }
    })
  }, [])

  // Navigate to specific question within current module
  const goToQuestion = useCallback((questionIndex: number) => {
    setExamState(prev => {
      const currentModule = prev.modules[prev.currentModuleIndex]
      
      if (questionIndex < 0 || questionIndex >= currentModule.questions.length) {
        // Invalid question index
        return prev
      }

      const newModules = [...prev.modules]
      newModules[prev.currentModuleIndex] = {
        ...newModules[prev.currentModuleIndex],
        currentQuestionIndex: questionIndex
      }

      return {
        ...prev,
        modules: newModules
      }
    })
  }, [])
  
  // Admin-only: Navigate to any module and question (for preview mode)
  const goToModuleAndQuestion = useCallback((moduleIndex: number, questionIndex: number) => {
    setExamState(prev => {
      if (moduleIndex < 0 || moduleIndex >= prev.modules.length) {
        // Invalid module index
        return prev
      }
      
      const targetModule = prev.modules[moduleIndex]
      if (questionIndex < 0 || questionIndex >= targetModule.questions.length) {
        // Invalid question index
        return prev
      }

      const newModules = [...prev.modules]
      newModules[moduleIndex] = {
        ...newModules[moduleIndex],
        currentQuestionIndex: questionIndex
      }

      return {
        ...prev,
        modules: newModules,
        currentModuleIndex: moduleIndex
      }
    })
  }, [])
  
  // Update a question in the cached state after successful save
  const updateQuestionInState = useCallback((updatedQuestion: Question) => {
    setExamState(prev => {
      const newModules = [...prev.modules]
      
      // Find the module containing this question
      for (let moduleIndex = 0; moduleIndex < newModules.length; moduleIndex++) {
        const module = newModules[moduleIndex]
        if (module.module === updatedQuestion.module_type) {
          // Find the question within this module
          const questionIndex = module.questions.findIndex(q => q.id === updatedQuestion.id)
          if (questionIndex !== -1) {
            // Update the question in the module
            const newQuestions = [...module.questions]
            newQuestions[questionIndex] = updatedQuestion
            
            newModules[moduleIndex] = {
              ...module,
              questions: newQuestions
            }
            
            console.log('📝 Question updated in exam state:', updatedQuestion.id)
            break
          }
        }
      }
      
      return {
        ...prev,
        modules: newModules
      }
    })
  }, [])

  // Complete exam
  const completeExam = useCallback(async () => {
    console.log('🏁 Starting exam completion process...')
    
    if (!examState.attempt) return

    console.log(`🚀 Submitting exam for attempt ID: ${examState.attempt.id}`)

    try {
      // Save remaining answers for the final module
      await saveModuleAnswers()
      
      // Get the current user session to include proper authentication
      console.log('🔐 Getting user session for authentication')
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Authentication error: Could not get user session')
      }
      
      console.log('✅ User session obtained, submitting to Edge Function')
      
      // Use the new Edge Function to calculate and store final scores with proper headers
      const { data: finalScores, error } = await supabase.functions.invoke('submit-exam', {
        body: JSON.stringify({ attempt_id: examState.attempt.id })
      })

      if (error) {
        console.error('❌ Edge Function error:', error)
        throw new Error(`Failed to submit exam: ${error.message}`)
      }

      if (!finalScores) {
        throw new Error('No scores returned from submission')
      }

      console.log('✅ Final scores received:', finalScores)
      setExamState(prev => ({
        ...prev,
        status: 'completed',
        finalScores // Store the server-calculated scores in state
      }))
    } catch (err: any) {
      console.error('💥 Complete exam error:', err)
      setError(err.message)
      throw err
    }
  }, [examState.attempt, saveModuleAnswers])

  // Move to next module
  const nextModule = useCallback(async (isPreview: boolean = false) => {
    console.log('nextModule called:', {
      hasAttempt: !!examState.attempt,
      currentModuleIndex: examState.currentModuleIndex,
      totalModules: examState.modules.length,
      isPreview
    })
    
    if (!examState.attempt && !isPreview) {
      console.error('No attempt found, cannot advance module')
      return
    }

    const nextModuleIndex = examState.currentModuleIndex + 1
    console.log('Attempting to advance to module index:', nextModuleIndex)
    
    try {
      // Save all answers for the current module (skip in preview mode)
      if (!isPreview) {
        console.log('Saving module answers...')
        await saveModuleAnswers()
        console.log('Module answers saved successfully')
      } else {
        console.log('Preview mode: skipping answer saving')
      }
      
      if (nextModuleIndex >= examState.modules.length) {
        // Complete exam
        console.log('Reached end of modules, completing exam')
        if (!isPreview) {
          await completeExam()
        } else {
          console.log('Preview mode: exam completed, not saving to database')
        }
        return
      }

      const nextModuleName = MODULE_ORDER[nextModuleIndex]
      console.log('Advancing to module:', nextModuleName)
      
      // Update attempt in database (skip in preview mode)
      if (!isPreview && examState.attempt) {
        await ExamService.updateTestAttempt(examState.attempt.id, {
          current_module: nextModuleName,
          current_question_number: 1
        })
        console.log('Database updated successfully')
      } else {
        console.log('Preview mode: skipping database update')
      }

      setExamState(prev => {
        const newModules = [...prev.modules]
        // Mark current module as completed
        newModules[prev.currentModuleIndex] = {
          ...newModules[prev.currentModuleIndex],
          completed: true
        }
        
        // Reset the next module's timer to full time
        if (newModules[nextModuleIndex]) {
          newModules[nextModuleIndex] = {
            ...newModules[nextModuleIndex],
            timeRemaining: newModules[nextModuleIndex].timeLimit * 60 // Reset to full time in seconds
          }
        }

        console.log('Updating exam state to module index:', nextModuleIndex)
        return {
          ...prev,
          modules: newModules,
          currentModuleIndex: nextModuleIndex
        }
      })
      console.log('Exam state updated successfully')
    } catch (err: any) {
      console.error('Error in nextModule:', err)
      setError(err.message)
      throw err
    }
  }, [examState, saveModuleAnswers, completeExam])

  // Handle timer expiration for current module
  const handleTimeExpired = useCallback(async (isPreview: boolean = false) => {
    console.log('Hook handleTimeExpired called:', {
      currentModuleIndex: examState.currentModuleIndex,
      totalModules: examState.modules.length,
      isLastModule: examState.currentModuleIndex >= examState.modules.length - 1,
      isPreview
    })
    
    try {
      // Auto-advance to next module or complete exam
      if (examState.currentModuleIndex < examState.modules.length - 1) {
        console.log('Advancing to next module...')
        await nextModule(isPreview)
        console.log('Successfully advanced to next module')
      } else {
        console.log('Completing exam...')
        if (!isPreview) {
          await completeExam()
        } else {
          console.log('Preview mode: exam completed, not saving to database')
        }
        console.log('Successfully completed exam')
      }
    } catch (error) {
      console.error('Error in handleTimeExpired:', error)
      throw error
    }
  }, [examState.currentModuleIndex, examState.modules.length, nextModule, completeExam])

  // Update timer for current module
  const updateTimer = useCallback((remainingSeconds: number) => {
    setExamState(prev => {
      // Prevent unnecessary updates if time hasn't changed
      const currentModule = prev.modules[prev.currentModuleIndex]
      if (!currentModule || currentModule.timeRemaining === remainingSeconds) {
        return prev
      }

      const newModules = [...prev.modules]
      newModules[prev.currentModuleIndex] = {
        ...newModules[prev.currentModuleIndex],
        timeRemaining: remainingSeconds
      }

      return {
        ...prev,
        modules: newModules
      }
    })
  }, [])

  // Get current question
  const getCurrentQuestion = useCallback(() => {
    if (examState.modules.length === 0 || examState.currentModuleIndex >= examState.modules.length) {
      return null
    }
    
    const currentModule = examState.modules[examState.currentModuleIndex]
    if (!currentModule || !currentModule.questions || currentModule.questions.length === 0) {
      return null
    }
    
    const question = currentModule.questions[currentModule.currentQuestionIndex] || null
    return question
  }, [examState.modules, examState.currentModuleIndex])

  // Get current answer
  const getCurrentAnswer = useCallback(() => {
    const currentQuestion = getCurrentQuestion()
    if (!currentQuestion) return undefined

    const currentModule = examState.modules[examState.currentModuleIndex]
    return currentModule.answers[currentQuestion.id]?.answer
  }, [examState.modules, examState.currentModuleIndex, getCurrentQuestion])

  // Toggle mark for review
  const toggleMarkForReview = useCallback((questionId?: string) => {
    const currentQuestion = getCurrentQuestion()
    const questionToToggle = questionId || currentQuestion?.id
    
    if (!questionToToggle) return

    setExamState(prev => {
      const newModules = [...prev.modules]
      const currentModule = newModules[prev.currentModuleIndex]
      
      if (currentModule) {
        const newMarkedForReview = new Set(currentModule.markedForReview)
        
        if (newMarkedForReview.has(questionToToggle)) {
          newMarkedForReview.delete(questionToToggle)
        } else {
          newMarkedForReview.add(questionToToggle)
        }
        
        newModules[prev.currentModuleIndex] = {
          ...currentModule,
          markedForReview: newMarkedForReview
        }
        
      }

      return {
        ...prev,
        modules: newModules
      }
    })
  }, [getCurrentQuestion])

  // Check if current question is marked for review
  const isMarkedForReview = useCallback((questionId?: string) => {
    const currentQuestion = getCurrentQuestion()
    const questionToCheck = questionId || currentQuestion?.id
    
    if (!questionToCheck) return false

    const currentModule = examState.modules[examState.currentModuleIndex]
    return currentModule?.markedForReview.has(questionToCheck) || false
  }, [examState.modules, examState.currentModuleIndex, getCurrentQuestion])

  // Get all marked questions in current module
  const getMarkedQuestions = useCallback(() => {
    const currentModule = examState.modules[examState.currentModuleIndex]
    if (!currentModule) return []

    return currentModule.questions
      .map((question, index) => ({
        question,
        index,
        isMarked: currentModule.markedForReview.has(question.id)
      }))
      .filter(item => item.isMarked)
  }, [examState.modules, examState.currentModuleIndex])

  // Continue with existing attempt
  const continueExistingAttempt = useCallback(async () => {
    if (!examState.existingAttempt || !examState.exam) return

    console.log('continueExistingAttempt: Starting with', {
      existingAttempt: examState.existingAttempt,
      exam: examState.exam.title
    })

    setLoading(true)
    try {
      // Load existing answers for this attempt
      const existingAnswers = await ExamService.getUserAnswers(examState.existingAttempt.id)
      console.log('continueExistingAttempt: Found existing answers:', existingAnswers.length)
      
      // Load questions for all modules
      const moduleStates: ModuleState[] = []
      
      for (const moduleType of MODULE_ORDER) {
        const questions = await ExamService.getQuestions(examState.exam.id, moduleType)
        const timeLimit = examState.exam.time_limits[moduleType] || 60

        console.log(`continueExistingAttempt: Module ${moduleType} has ${questions.length} questions`)

        // Skip modules with no questions
        if (questions.length === 0) {
          console.warn(`continueExistingAttempt: Skipping module ${moduleType} - no questions found`)
          continue
        }

        // Build answers map for this module from existing database answers
        const moduleAnswers: Record<string, ExamAnswer> = {}
        existingAnswers.forEach(answer => {
          const question = questions.find(q => q.id === answer.question_id)
          if (question && answer.user_answer) {
            moduleAnswers[answer.question_id] = {
              questionId: answer.question_id,
              answer: answer.user_answer,
              timeSpent: answer.time_spent_seconds,
              answeredAt: new Date(answer.answered_at)
            }
          }
        })

        // Determine if this module is completed (has answers for all questions)
        const isCompleted = questions.length > 0 && questions.every(q => moduleAnswers[q.id])

        // Set current question index based on the existing attempt's current question number
        let currentQuestionIndex = 0
        if (moduleType === examState.existingAttempt.current_module) {
          currentQuestionIndex = Math.max(0, (examState.existingAttempt.current_question_number || 1) - 1)
        } else if (isCompleted) {
          currentQuestionIndex = questions.length - 1
        }

        console.log(`continueExistingAttempt: Module ${moduleType} setup:`, {
          questionsLength: questions.length,
          answersCount: Object.keys(moduleAnswers).length,
          isCompleted,
          currentQuestionIndex
        })

        moduleStates.push({
          module: moduleType,
          questions,
          currentQuestionIndex,
          answers: moduleAnswers,
          markedForReview: new Set(),
          timeLimit,
          timeRemaining: timeLimit * 60,
          completed: isCompleted
        })
      }

      // Ensure we have at least one module with questions
      if (moduleStates.length === 0) {
        throw new Error('No questions found for any module in this exam')
      }

      // Find current module index based on existing attempt (within the filtered modules)
      const attemptCurrentModule = examState.existingAttempt.current_module || 'english1'
      const currentModuleIndex = moduleStates.findIndex(module => module.module === attemptCurrentModule)
      const validCurrentModuleIndex = currentModuleIndex >= 0 ? currentModuleIndex : 0

      console.log('continueExistingAttempt: Final state setup:', {
        attemptCurrentModule,
        currentModuleIndex: validCurrentModuleIndex,
        modulesCount: moduleStates.length,
        availableModules: moduleStates.map(m => m.module),
        status: examState.existingAttempt.status
      })

      // If the existing attempt was expired, reactivate it
      if (examState.existingAttempt.status === 'expired') {
        console.log('continueExistingAttempt: Reactivating expired attempt')
        await ExamService.updateTestAttempt(examState.existingAttempt.id, {
          status: 'in_progress'
        })
      }

      setExamState({
        exam: examState.exam,
        attempt: examState.existingAttempt,
        modules: moduleStates,
        currentModuleIndex: validCurrentModuleIndex,
        status: 'in_progress', // Always set to in_progress when continuing
        startedAt: examState.existingAttempt.started_at ? new Date(examState.existingAttempt.started_at) : null,
        existingAttempt: null,
        showConflictModal: false
      })
    } catch (err: any) {
      console.error('continueExistingAttempt: Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [examState.existingAttempt, examState.exam])

  // Discard existing attempt and start new
  const discardAndStartNew = useCallback(async () => {
    if (!examState.existingAttempt || !examState.exam || !user) return

    setLoading(true)
    try {
      // Delete existing attempt
      await ExamService.deleteTestAttempt(examState.existingAttempt.id)
      
      // Create new test attempt
      const attempt = await ExamService.createTestAttempt({
        user_id: user.id,
        exam_id: examState.exam.id,
        status: 'not_started',
        current_module: 'english1'
      })

      // Load questions for all modules
      const moduleStates: ModuleState[] = []
      
      for (const moduleType of MODULE_ORDER) {
        const questions = await ExamService.getQuestions(examState.exam.id, moduleType)
        const timeLimit = examState.exam.time_limits[moduleType] || 60

        console.log(`discardAndStartNew: Module ${moduleType} has ${questions.length} questions`)

        // Skip modules with no questions
        if (questions.length === 0) {
          console.warn(`discardAndStartNew: Skipping module ${moduleType} - no questions found`)
          continue
        }

        moduleStates.push({
          module: moduleType,
          questions,
          currentQuestionIndex: 0,
          answers: {},
          markedForReview: new Set(),
          timeLimit,
          timeRemaining: timeLimit * 60,
          completed: false
        })
      }

      // Ensure we have at least one module with questions
      if (moduleStates.length === 0) {
        throw new Error('No questions found for any module in this exam')
      }

      setExamState({
        exam: examState.exam,
        attempt,
        modules: moduleStates,
        currentModuleIndex: 0,
        status: 'not_started',
        startedAt: null,
        existingAttempt: null,
        showConflictModal: false
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [examState.existingAttempt, examState.exam, user])

  // Close conflict modal - redirect back to dashboard
  const closeConflictModal = useCallback((router?: any) => {
    setExamState(prev => ({
      ...prev,
      showConflictModal: false,
      existingAttempt: null
    }))
    
    // Redirect to dashboard if router is provided
    if (router) {
      router.push('/student/dashboard')
    }
  }, [])

  // Force cleanup state - used when forcefully exiting
  const forceCleanup = useCallback(() => {
    setExamState({
      exam: null,
      attempt: null,
      modules: [],
      currentModuleIndex: 0,
      status: 'not_started',
      startedAt: null,
      existingAttempt: null,
      showConflictModal: false
    })
  }, [])


  return {
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
    handleTimeExpired,
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
  }
}