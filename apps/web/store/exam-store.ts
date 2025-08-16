import { create } from 'zustand'
import { ExamService, type Question, type Exam, type TestAttempt, type ModuleType } from '../lib/exam-service'
import { checkAnswer, normalizeCorrectAnswers } from '../lib/answer-checker'
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
  // State
  exam: Exam | null
  attempt: TestAttempt | null
  modules: ModuleState[]
  currentModuleIndex: number
  status: 'not_started' | 'in_progress' | 'completed' | 'expired'
  startedAt: Date | null
  existingAttempt: TestAttempt | null
  showConflictModal: boolean
  finalScores?: FinalScores
  loading: boolean
  error: string | null

  // Actions
  initializeExam: (examId: string, userId: string) => Promise<void>
  startExam: () => Promise<void>
  setLocalAnswer: (answer: string) => void
  saveModuleAnswers: () => Promise<void>
  nextQuestion: () => void
  previousQuestion: () => void
  goToQuestion: (questionIndex: number) => void
  nextModule: () => Promise<void>
  completeExam: () => Promise<void>
  handleTimeExpired: () => Promise<void>
  updateTimer: (remainingSeconds: number) => void
  getCurrentQuestion: () => Question | null
  getCurrentAnswer: () => string | undefined
  toggleMarkForReview: (questionId?: string) => void
  isMarkedForReview: (questionId?: string) => boolean
  getMarkedQuestions: () => Array<{ question: Question; index: number; isMarked: boolean }>
  continueExistingAttempt: () => Promise<void>
  discardAndStartNew: (userId: string) => Promise<void>
  closeConflictModal: (router?: any) => void
  forceCleanup: () => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
}

const MODULE_ORDER: ModuleType[] = ['english1', 'english2', 'math1', 'math2']

export const useExamStore = create<ExamState>((set, get) => ({
  // Initial state
  exam: null,
  attempt: null,
  modules: [],
  currentModuleIndex: 0,
  status: 'not_started',
  startedAt: null,
  existingAttempt: null,
  showConflictModal: false,
  loading: false,
  error: null,

  // Actions
  setError: (error: string | null) => set({ error }),
  setLoading: (loading: boolean) => set({ loading }),

  initializeExam: async (examId: string, userId: string) => {
    console.log('initializeExam: Starting initialization for exam:', examId, 'user:', userId)
    set({ loading: true, error: null })

    try {
      // Get exam details
      console.log('initializeExam: Fetching exam details...')
      const exam = await ExamService.getExam(examId)
      if (!exam) {
        console.error('initializeExam: Exam not found')
        throw new Error('Exam not found')
      }
      console.log('initializeExam: Exam found:', exam.title)

      // Check if student has access to this exam
      console.log('initializeExam: Checking exam access...')
      const hasAccess = await ExamService.hasExamAccess(userId, examId)
      if (!hasAccess) {
        console.error('initializeExam: Access denied - exam not assigned to student')
        throw new Error('You do not have access to this exam. Please contact your administrator.')
      }
      console.log('initializeExam: Access granted')

      // Check for existing in-progress attempt BEFORE cleanup
      console.log('initializeExam: Checking for existing attempts...')
      const existingAttempt = await ExamService.getInProgressAttempt(userId, examId)
      
      if (existingAttempt) {
        console.log('initializeExam: Found existing attempt, showing conflict modal')
        set({
          exam,
          existingAttempt,
          showConflictModal: true,
          loading: false
        })
        return
      }

      // Clean up any duplicate attempts only after checking for valid existing attempts
      console.log('initializeExam: Cleaning up duplicate attempts...')
      await ExamService.cleanupDuplicateAttempts(userId, examId)

      // Create new test attempt
      console.log('initializeExam: Creating new test attempt...')
      const attempt = await ExamService.createTestAttempt({
        user_id: userId,
        exam_id: examId,
        status: 'not_started',
        current_module: 'english1'
      })
      console.log('initializeExam: Test attempt created:', attempt.id)

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
      set({
        exam,
        attempt,
        modules: moduleStates,
        currentModuleIndex: 0,
        status: 'not_started',
        startedAt: null,
        existingAttempt: null,
        showConflictModal: false,
        loading: false
      })
      console.log('initializeExam: Exam state set successfully')
    } catch (err: any) {
      console.error('initializeExam: Error occurred:', err)
      set({ error: err.message, loading: false })
    }
  },

  startExam: async () => {
    const { attempt } = get()
    if (!attempt) return

    try {
      await ExamService.updateTestAttempt(attempt.id, {
        status: 'in_progress',
        started_at: new Date().toISOString(),
        current_module: 'english1'
      })

      set({
        status: 'in_progress',
        startedAt: new Date()
      })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  setLocalAnswer: (answer: string) => {
    const { attempt, status, modules, currentModuleIndex } = get()
    if (!attempt || status !== 'in_progress') return

    const currentModule = modules[currentModuleIndex]
    const currentQuestion = currentModule.questions[currentModule.currentQuestionIndex]
    
    if (!currentQuestion) return

    // Update local state only
    const examAnswer: ExamAnswer = {
      questionId: currentQuestion.id,
      answer,
      timeSpent: 0,
      answeredAt: new Date()
    }

    const newModules = [...modules]
    newModules[currentModuleIndex] = {
      ...newModules[currentModuleIndex],
      answers: {
        ...newModules[currentModuleIndex].answers,
        [currentQuestion.id]: examAnswer
      }
    }

    set({ modules: newModules })
  },

  saveModuleAnswers: async () => {
    const { attempt, status, modules, currentModuleIndex } = get()
    if (!attempt || status !== 'in_progress') return

    const currentModule = modules[currentModuleIndex]
    
    try {
      // Save all answers for this module
      for (const [questionId, examAnswer] of Object.entries(currentModule.answers)) {
        const question = currentModule.questions.find(q => q.id === questionId)
        if (question && examAnswer.answer) {
          // Use normalizeCorrectAnswers to handle both grid_in and multiple_choice questions
          const rawCorrectAnswers = question.question_type === 'grid_in' 
            ? question.correct_answers || [question.correct_answer]
            : question.correct_answer
          
          // Normalize the correct answers to handle double-encoded JSON
          const normalizedCorrectAnswers = normalizeCorrectAnswers(rawCorrectAnswers)
          
          // ================== DIAGNOSTIC LOG START ==================
          console.log(`
            ----------------------------------------------------
            [DEBUG] Comparing Answer for Question ID: ${question.id}
            ----------------------------------------------------
            - Question Type:         ${question.question_type}
            - Student Answer (raw):  '${examAnswer.answer}'
            - Student Answer Type:   ${typeof examAnswer.answer}

            - Correct Answer (single): '${question.correct_answer}'
            - Correct Answer Type:   ${typeof question.correct_answer}

            - Correct Answers (array): ${JSON.stringify(question.correct_answers)}
            - Correct Answers Type:  ${typeof question.correct_answers}
            
            - Raw correctAnswers: ${JSON.stringify(rawCorrectAnswers)}
            - Normalized correctAnswers: ${JSON.stringify(normalizedCorrectAnswers)}
            ----------------------------------------------------
          `)
          // =================== DIAGNOSTIC LOG END ===================
          
          const isCorrect = checkAnswer(examAnswer.answer, normalizedCorrectAnswers)
          console.log(`[RESULT] Comparison result for Question ID ${question.id}: ${isCorrect}`)
          
          await ExamService.submitAnswer({
            attempt_id: attempt.id,
            question_id: questionId,
            user_answer: examAnswer.answer,
            is_correct: isCorrect,
            time_spent_seconds: examAnswer.timeSpent
          })
        }
      }
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  nextQuestion: () => {
    const { modules, currentModuleIndex } = get()
    const currentModule = modules[currentModuleIndex]
    const nextQuestionIndex = currentModule.currentQuestionIndex + 1

    if (nextQuestionIndex >= currentModule.questions.length) {
      // Should not happen - use nextModule instead
      return
    }

    const newModules = [...modules]
    newModules[currentModuleIndex] = {
      ...newModules[currentModuleIndex],
      currentQuestionIndex: nextQuestionIndex
    }

    set({ modules: newModules })
  },

  previousQuestion: () => {
    const { modules, currentModuleIndex } = get()
    const currentModule = modules[currentModuleIndex]
    const prevQuestionIndex = currentModule.currentQuestionIndex - 1

    if (prevQuestionIndex < 0) {
      // Can't go before first question in module
      return
    }

    const newModules = [...modules]
    newModules[currentModuleIndex] = {
      ...newModules[currentModuleIndex],
      currentQuestionIndex: prevQuestionIndex
    }

    set({ modules: newModules })
  },

  goToQuestion: (questionIndex: number) => {
    const { modules, currentModuleIndex } = get()
    const currentModule = modules[currentModuleIndex]
    
    if (questionIndex < 0 || questionIndex >= currentModule.questions.length) {
      // Invalid question index
      return
    }

    const newModules = [...modules]
    newModules[currentModuleIndex] = {
      ...newModules[currentModuleIndex],
      currentQuestionIndex: questionIndex
    }

    set({ modules: newModules })
  },

  completeExam: async () => {
    console.log('🏁 Starting exam completion process...')
    
    const { attempt, saveModuleAnswers } = get()
    if (!attempt) return

    console.log(`🚀 Submitting exam for attempt ID: ${attempt.id}`)

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
        body: JSON.stringify({ attempt_id: attempt.id })
      })

      if (error) {
        console.error('❌ Edge Function error:', error)
        throw new Error(`Failed to submit exam: ${error.message}`)
      }

      if (!finalScores) {
        throw new Error('No scores returned from submission')
      }

      console.log('✅ Final scores received:', finalScores)
      set({
        status: 'completed',
        finalScores // Store the server-calculated scores in state
      })
    } catch (err: any) {
      console.error('💥 Complete exam error:', err)
      set({ error: err.message })
      throw err
    }
  },

  nextModule: async () => {
    const { attempt, currentModuleIndex, modules, saveModuleAnswers, completeExam } = get()
    
    console.log('nextModule called:', {
      hasAttempt: !!attempt,
      currentModuleIndex,
      totalModules: modules.length
    })
    
    if (!attempt) {
      console.error('No attempt found, cannot advance module')
      return
    }

    const nextModuleIndex = currentModuleIndex + 1
    console.log('Attempting to advance to module index:', nextModuleIndex)
    
    try {
      // Save all answers for the current module
      console.log('Saving module answers...')
      await saveModuleAnswers()
      console.log('Module answers saved successfully')
      
      if (nextModuleIndex >= modules.length) {
        // Complete exam
        console.log('Reached end of modules, completing exam')
        await completeExam()
        return
      }

      const nextModuleName = MODULE_ORDER[nextModuleIndex]
      console.log('Advancing to module:', nextModuleName)
      
      // Update attempt in database
      await ExamService.updateTestAttempt(attempt.id, {
        current_module: nextModuleName,
        current_question_number: 1
      })
      console.log('Database updated successfully')

      const newModules = [...modules]
      // Mark current module as completed
      newModules[currentModuleIndex] = {
        ...newModules[currentModuleIndex],
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
      set({
        modules: newModules,
        currentModuleIndex: nextModuleIndex
      })
      console.log('Exam state updated successfully')
    } catch (err: any) {
      console.error('Error in nextModule:', err)
      set({ error: err.message })
      throw err
    }
  },

  handleTimeExpired: async () => {
    const { currentModuleIndex, modules, nextModule, completeExam } = get()
    
    console.log('Hook handleTimeExpired called:', {
      currentModuleIndex,
      totalModules: modules.length,
      isLastModule: currentModuleIndex >= modules.length - 1
    })
    
    try {
      // Auto-advance to next module or complete exam
      if (currentModuleIndex < modules.length - 1) {
        console.log('Advancing to next module...')
        await nextModule()
        console.log('Successfully advanced to next module')
      } else {
        console.log('Completing exam...')
        await completeExam()
        console.log('Successfully completed exam')
      }
    } catch (error) {
      console.error('Error in handleTimeExpired:', error)
      throw error
    }
  },

  updateTimer: (remainingSeconds: number) => {
    const { modules, currentModuleIndex } = get()
    
    // Prevent unnecessary updates if time hasn't changed
    const currentModule = modules[currentModuleIndex]
    if (!currentModule || currentModule.timeRemaining === remainingSeconds) {
      return
    }

    const newModules = [...modules]
    newModules[currentModuleIndex] = {
      ...newModules[currentModuleIndex],
      timeRemaining: remainingSeconds
    }

    set({ modules: newModules })
  },

  getCurrentQuestion: () => {
    const { modules, currentModuleIndex } = get()
    
    if (modules.length === 0 || currentModuleIndex >= modules.length) {
      return null
    }
    
    const currentModule = modules[currentModuleIndex]
    if (!currentModule || !currentModule.questions || currentModule.questions.length === 0) {
      return null
    }
    
    const question = currentModule.questions[currentModule.currentQuestionIndex] || null
    return question
  },

  getCurrentAnswer: () => {
    const { modules, currentModuleIndex, getCurrentQuestion } = get()
    const currentQuestion = getCurrentQuestion()
    if (!currentQuestion) return undefined

    const currentModule = modules[currentModuleIndex]
    return currentModule.answers[currentQuestion.id]?.answer
  },

  toggleMarkForReview: (questionId?: string) => {
    const { modules, currentModuleIndex, getCurrentQuestion } = get()
    const currentQuestion = getCurrentQuestion()
    const questionToToggle = questionId || currentQuestion?.id
    
    if (!questionToToggle) return

    const newModules = [...modules]
    const currentModule = newModules[currentModuleIndex]
    
    if (currentModule) {
      const newMarkedForReview = new Set(currentModule.markedForReview)
      
      if (newMarkedForReview.has(questionToToggle)) {
        newMarkedForReview.delete(questionToToggle)
      } else {
        newMarkedForReview.add(questionToToggle)
      }
      
      newModules[currentModuleIndex] = {
        ...currentModule,
        markedForReview: newMarkedForReview
      }
    }

    set({ modules: newModules })
  },

  isMarkedForReview: (questionId?: string) => {
    const { modules, currentModuleIndex, getCurrentQuestion } = get()
    const currentQuestion = getCurrentQuestion()
    const questionToCheck = questionId || currentQuestion?.id
    
    if (!questionToCheck) return false

    const currentModule = modules[currentModuleIndex]
    return currentModule?.markedForReview.has(questionToCheck) || false
  },

  getMarkedQuestions: () => {
    const { modules, currentModuleIndex } = get()
    const currentModule = modules[currentModuleIndex]
    if (!currentModule) return []

    return currentModule.questions
      .map((question, index) => ({
        question,
        index,
        isMarked: currentModule.markedForReview.has(question.id)
      }))
      .filter(item => item.isMarked)
  },

  continueExistingAttempt: async () => {
    const { existingAttempt, exam } = get()
    if (!existingAttempt || !exam) return

    console.log('continueExistingAttempt: Starting with', {
      existingAttempt,
      exam: exam.title
    })

    set({ loading: true })
    try {
      // Load existing answers for this attempt
      const existingAnswers = await ExamService.getUserAnswers(existingAttempt.id)
      console.log('continueExistingAttempt: Found existing answers:', existingAnswers.length)
      
      // Load questions for all modules
      const moduleStates: ModuleState[] = []
      
      for (const moduleType of MODULE_ORDER) {
        const questions = await ExamService.getQuestions(exam.id, moduleType)
        const timeLimit = exam.time_limits[moduleType] || 60

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
        if (moduleType === existingAttempt.current_module) {
          currentQuestionIndex = Math.max(0, (existingAttempt.current_question_number || 1) - 1)
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
      const attemptCurrentModule = existingAttempt.current_module || 'english1'
      const currentModuleIndex = moduleStates.findIndex(module => module.module === attemptCurrentModule)
      const validCurrentModuleIndex = currentModuleIndex >= 0 ? currentModuleIndex : 0

      console.log('continueExistingAttempt: Final state setup:', {
        attemptCurrentModule,
        currentModuleIndex: validCurrentModuleIndex,
        modulesCount: moduleStates.length,
        availableModules: moduleStates.map(m => m.module),
        status: existingAttempt.status
      })

      // If the existing attempt was expired, reactivate it
      if (existingAttempt.status === 'expired') {
        console.log('continueExistingAttempt: Reactivating expired attempt')
        await ExamService.updateTestAttempt(existingAttempt.id, {
          status: 'in_progress'
        })
      }

      set({
        exam,
        attempt: existingAttempt,
        modules: moduleStates,
        currentModuleIndex: validCurrentModuleIndex,
        status: 'in_progress', // Always set to in_progress when continuing
        startedAt: existingAttempt.started_at ? new Date(existingAttempt.started_at) : null,
        existingAttempt: null,
        showConflictModal: false,
        loading: false
      })
    } catch (err: any) {
      console.error('continueExistingAttempt: Error:', err)
      set({ error: err.message, loading: false })
    }
  },

  discardAndStartNew: async (userId: string) => {
    const { existingAttempt, exam } = get()
    if (!existingAttempt || !exam) return

    set({ loading: true })
    try {
      // Delete existing attempt
      await ExamService.deleteTestAttempt(existingAttempt.id)
      
      // Create new test attempt
      const attempt = await ExamService.createTestAttempt({
        user_id: userId,
        exam_id: exam.id,
        status: 'not_started',
        current_module: 'english1'
      })

      // Load questions for all modules
      const moduleStates: ModuleState[] = []
      
      for (const moduleType of MODULE_ORDER) {
        const questions = await ExamService.getQuestions(exam.id, moduleType)
        const timeLimit = exam.time_limits[moduleType] || 60

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

      set({
        exam,
        attempt,
        modules: moduleStates,
        currentModuleIndex: 0,
        status: 'not_started',
        startedAt: null,
        existingAttempt: null,
        showConflictModal: false,
        loading: false
      })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  closeConflictModal: (router?: any) => {
    set({
      showConflictModal: false,
      existingAttempt: null
    })
    
    // Redirect to dashboard if router is provided
    if (router) {
      router.push('/student/dashboard')
    }
  },

  forceCleanup: () => {
    set({
      exam: null,
      attempt: null,
      modules: [],
      currentModuleIndex: 0,
      status: 'not_started',
      startedAt: null,
      existingAttempt: null,
      showConflictModal: false,
      loading: false,
      error: null
    })
  }
}))