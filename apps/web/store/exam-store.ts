import { create } from 'zustand'
import {
  ExamService,
  type Question,
  type Exam,
  type TestAttempt,
  type ModuleType,
} from '../lib/exam-service'
import { checkAnswer, normalizeCorrectAnswers } from '../lib/answer-checker'
import { supabase } from '../lib/supabase'

interface ExamAnswer {
  questionId: string
  answer: string
  timeSpent: number // seconds spent on this question
  answeredAt: Date
}

interface Highlight {
  start: number
  end: number
  text: string
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
  status:
    | 'not_started'
    | 'in_progress'
    | 'time_expired'
    | 'submitting'
    | 'completed'
    | 'expired'
  startedAt: Date | null
  existingAttempt: TestAttempt | null
  showConflictModal: boolean
  finalScores?: FinalScores
  loading: boolean
  error: string | null
  highlightsByQuestion: { [questionId: string]: Highlight[] }
  currentQuestionStartTime: number // Track when current question was first viewed

  // Actions
  initializeExam: (
    examId: string,
    userId: string,
    reviewForAttemptId?: string
  ) => Promise<void>
  initializeReviewMode: (
    examId: string,
    userId: string,
    reviewForAttemptId: string
  ) => Promise<void>
  startExam: () => Promise<void>
  setLocalAnswer: (answer: string) => void
  saveModuleAnswers: () => Promise<void>
  nextQuestion: () => void
  previousQuestion: () => void
  goToQuestion: (questionIndex: number) => void
  nextModule: () => Promise<void>
  completeExam: () => Promise<void>
  completeReviewSession: (originalAttemptId: string) => Promise<{
    success: boolean
    potentialScore?: number
    originalScore?: number
    improvement?: number
  }>
  timeExpired: () => void
  handleTimeExpired: () => Promise<void>
  updateTimer: (remainingSeconds: number) => void
  getCurrentQuestion: () => Question | null
  getCurrentAnswer: () => string | undefined
  toggleMarkForReview: (questionId?: string) => void
  isMarkedForReview: (questionId?: string) => boolean
  getMarkedQuestions: () => Array<{
    question: Question
    index: number
    isMarked: boolean
  }>
  continueExistingAttempt: () => Promise<void>
  discardAndStartNew: (userId: string) => Promise<void>
  closeConflictModal: (router?: any) => void
  forceCleanup: () => void
  setError: (error: string | null) => void
  setLoading: (loading: boolean) => void
  addHighlight: (questionId: string, highlight: Highlight) => void
  removeHighlight: (questionId: string, highlight: Highlight) => void
  saveCurrentAnswerImmediately: () => Promise<void>
}

const MODULE_ORDER: ModuleType[] = ['english1', 'english2', 'math1', 'math2']

// Native debounce implementation
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => func(...args), delay)
  }) as T & { cancel: () => void }

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debounced
}

// Real-time answer saving with debounce
interface SaveAnswerPayload {
  attemptId: string
  questionId: string
  answer: string
  timeSpent: number
}

// Core function to save answer to database
const saveAnswerToDB = async (payload: SaveAnswerPayload) => {
  console.log(`[AutoSave] Saving answer for question ${payload.questionId}`)

  try {
    // Use ExamService.submitAnswer to maintain consistency with existing save logic
    await ExamService.submitAnswer({
      attempt_id: payload.attemptId,
      question_id: payload.questionId,
      user_answer: payload.answer,
      time_spent_seconds: payload.timeSpent,
    })
    console.log(
      `[AutoSave] ✅ Successfully saved answer for question ${payload.questionId}`
    )
  } catch (error) {
    console.error(
      `[AutoSave] ❌ Failed to save answer for question ${payload.questionId}:`,
      error
    )
    // Could implement retry logic here if needed
  }
}

// Debounced version - waits 2 seconds after last call before executing
const debouncedSaveAnswer = debounce(saveAnswerToDB, 2000)

// Immediate save function (for navigation/beforeunload events)
const saveAnswerImmediately = async (payload: SaveAnswerPayload) => {
  // Cancel any pending debounced save for this question
  debouncedSaveAnswer.cancel()
  // Save immediately
  await saveAnswerToDB(payload)
}

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
  highlightsByQuestion: {},
  currentQuestionStartTime: 0,

  // Actions
  setError: (error: string | null) => set({ error }),
  setLoading: (loading: boolean) => set({ loading }),

  timeExpired: () => {
    console.log('timeExpired: Setting status to time_expired')
    set({ status: 'time_expired' })
  },

  initializeExam: async (
    examId: string,
    userId: string,
    reviewForAttemptId?: string
  ) => {
    console.log(
      'initializeExam: Starting initialization for exam:',
      examId,
      'user:',
      userId,
      reviewForAttemptId
        ? `(Review mode for attempt: ${reviewForAttemptId})`
        : '(Normal mode)'
    )
    set({ loading: true, error: null })

    // Handle review mode (Second Chance)
    if (reviewForAttemptId) {
      return get().initializeReviewMode(examId, userId, reviewForAttemptId)
    }

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
        console.error(
          'initializeExam: Access denied - exam not assigned to student'
        )
        throw new Error(
          'You do not have access to this exam. Please contact your administrator.'
        )
      }
      console.log('initializeExam: Access granted')

      // Check for existing in-progress attempt BEFORE cleanup
      console.log('initializeExam: Checking for existing attempts...')
      const existingAttempt = await ExamService.getInProgressAttempt(
        userId,
        examId
      )

      if (existingAttempt) {
        console.log(
          'initializeExam: Found existing attempt, showing conflict modal'
        )
        set({
          exam,
          existingAttempt,
          showConflictModal: true,
          loading: false,
        })
        return
      }

      // Clean up any duplicate attempts only after checking for valid existing attempts
      console.log('initializeExam: Cleaning up duplicate attempts...')
      await ExamService.cleanupDuplicateAttempts(userId, examId)

      // Create new test attempt
      console.log('initializeExam: Creating new test attempt...')

      // Check if there's impersonation data
      const impersonationData = localStorage.getItem('impersonation_data')
      let targetUserId = userId

      if (impersonationData) {
        try {
          const impersonationParsed = JSON.parse(impersonationData)
          if (impersonationParsed.target_user?.id) {
            targetUserId = impersonationParsed.target_user.id
          }
        } catch (error) {
          console.error('Failed to parse impersonation data:', error)
        }
      }

      // Use API route instead of server action for better reliability
      // First, ensure we have a fresh session
      console.log('initializeExam: Checking client session before API call...')
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      console.log('initializeExam: Client session check:', {
        hasSession: !!session,
        sessionError,
        userEmail: session?.user?.email,
        accessToken: session?.access_token ? 'present' : 'missing',
      })

      if (sessionError) {
        console.error('initializeExam: Session error:', sessionError)
        // Try to refresh the session
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession()
        console.log('initializeExam: Refresh attempt:', {
          success: !!refreshedSession,
          error: refreshError,
        })

        if (refreshError || !refreshedSession) {
          throw new Error('Authentication failed - please log in again')
        }
      }

      if (!session) {
        console.error('initializeExam: No session found, attempting refresh...')
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession()

        if (refreshError || !refreshedSession) {
          throw new Error(
            'Authentication required - please refresh the page and log in again'
          )
        }
        console.log('initializeExam: Session refreshed successfully')
      }

      console.log(
        'initializeExam: Session validated before API call, user:',
        session?.user?.email || 'unknown'
      )

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      // Add Authorization header with access token
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
        console.log(
          'initializeExam: Added Authorization header with access token'
        )
      } else {
        console.warn(
          'initializeExam: No access token available for Authorization header'
        )
      }

      if (impersonationData) {
        headers['x-impersonation-data'] = impersonationData
      }

      const response = await fetch('/api/test-attempts', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({
          exam_id: examId,
          status: 'not_started',
          current_module: 'english1',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create test attempt')
      }

      const attempt = await response.json()

      console.log('initializeExam: Test attempt created:', attempt.id)

      // Load questions for all modules
      const moduleStates: ModuleState[] = []
      console.log('initializeExam: Loading questions for all modules...')

      for (const moduleType of MODULE_ORDER) {
        console.log(
          `initializeExam: Fetching questions for module: ${moduleType}`
        )
        try {
          const questions = await ExamService.getQuestions(examId, moduleType)
          const timeLimit = exam.time_limits[moduleType] || 60

          console.log(
            `initializeExam: Module ${moduleType} loaded ${questions.length} questions`
          )

          // Skip modules with no questions (don't add them to the array)
          if (questions.length === 0) {
            console.warn(
              `initializeExam: Skipping module ${moduleType} - no questions found`
            )
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
            completed: false,
          })

          console.log(
            `✅ initializeExam: Successfully added module ${moduleType} with ${questions.length} questions`
          )
        } catch (error: any) {
          console.error(
            `❌ initializeExam: Error loading questions for module ${moduleType}:`,
            error
          )
          throw new Error(
            `Failed to load questions for ${moduleType}: ${error.message}`
          )
        }
      }

      console.log(
        'initializeExam: Final module states:',
        moduleStates.length,
        'modules loaded'
      )

      // Ensure we have at least one module with questions
      if (moduleStates.length === 0) {
        console.error('initializeExam: No modules with questions found!')
        throw new Error('No questions found for any module in this exam')
      }

      // Load highlights from localStorage
      const savedHighlightsJSON = localStorage.getItem(
        `highlights_${attempt.id}`
      )
      let savedHighlights = {}
      if (savedHighlightsJSON) {
        try {
          savedHighlights = JSON.parse(savedHighlightsJSON)
        } catch (e) {
          console.error('Failed to parse saved highlights:', e)
        }
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
        loading: false,
        highlightsByQuestion: savedHighlights,
        currentQuestionStartTime: Date.now(), // Initialize timer for first question
      })
      console.log('initializeExam: Exam state set successfully')
    } catch (err: any) {
      console.error('initializeExam: Error occurred:', err)
      set({ error: err.message, loading: false })
    }
  },

  initializeReviewMode: async (
    examId: string,
    userId: string,
    reviewForAttemptId: string
  ) => {
    console.log('initializeReviewMode: Starting review mode initialization')

    try {
      // Get original exam details
      const exam = await ExamService.getExam(examId)
      if (!exam) {
        throw new Error('Exam not found')
      }
      console.log('initializeReviewMode: Exam found:', exam.title)

      // Get incorrect questions for the original attempt
      console.log('initializeReviewMode: Fetching incorrect questions...')
      const incorrectQuestions =
        await ExamService.getIncorrectQuestionsForAttempt(reviewForAttemptId)

      if (incorrectQuestions.length === 0) {
        throw new Error('No incorrect questions found for review')
      }

      console.log(
        `initializeReviewMode: Found ${incorrectQuestions.length} questions to review`
      )

      // Create a single "review" module containing all incorrect questions
      // We'll use the first question's module type, but display will be handled dynamically
      const firstQuestionModule =
        incorrectQuestions[0]?.module_type || 'english1'
      const reviewModule: ModuleState = {
        module: firstQuestionModule, // Use first question's module type
        questions: incorrectQuestions,
        currentQuestionIndex: 0,
        answers: {},
        markedForReview: new Set(),
        timeLimit: 999, // No time limit (999 minutes)
        timeRemaining: 999 * 60, // Convert to seconds
        completed: false,
      }

      console.log('initializeReviewMode: Setting review state...')
      set({
        exam,
        attempt: null, // No actual attempt record for review mode
        modules: [reviewModule],
        currentModuleIndex: 0,
        status: 'in_progress', // Start immediately in review mode
        startedAt: new Date(),
        existingAttempt: null,
        showConflictModal: false,
        loading: false,
        highlightsByQuestion: {},
        currentQuestionStartTime: Date.now(),
      })
      console.log('initializeReviewMode: Review state set successfully')
    } catch (err: any) {
      console.error('initializeReviewMode: Error occurred:', err)
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
        current_module: 'english1',
      })

      set({
        status: 'in_progress',
        startedAt: new Date(),
      })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  setLocalAnswer: (answer: string) => {
    const {
      attempt,
      status,
      modules,
      currentModuleIndex,
      currentQuestionStartTime,
    } = get()

    // Allow operation in review mode (attempt is null) or normal in_progress mode
    const isReviewMode = !attempt && status === 'in_progress'
    const isNormalMode = attempt && status === 'in_progress'

    if (!isReviewMode && !isNormalMode) return

    const currentModule = modules[currentModuleIndex]
    const currentQuestion =
      currentModule.questions[currentModule.currentQuestionIndex]

    if (!currentQuestion) return

    // Calculate time spent on this question
    const timeSpentSeconds =
      currentQuestionStartTime > 0
        ? Math.round((Date.now() - currentQuestionStartTime) / 1000)
        : 0

    // Update local state with calculated time
    const examAnswer: ExamAnswer = {
      questionId: currentQuestion.id,
      answer,
      timeSpent: timeSpentSeconds,
      answeredAt: new Date(),
    }

    const newModules = [...modules]
    newModules[currentModuleIndex] = {
      ...newModules[currentModuleIndex],
      answers: {
        ...newModules[currentModuleIndex].answers,
        [currentQuestion.id]: examAnswer,
      },
    }

    // Update local state immediately for instant UI feedback
    set({ modules: newModules })

    // Only trigger database save in normal mode (not review mode)
    if (attempt && answer.trim()) {
      debouncedSaveAnswer({
        attemptId: attempt.id,
        questionId: currentQuestion.id,
        answer: answer.trim(),
        timeSpent: timeSpentSeconds,
      })
    }
  },

  saveModuleAnswers: async () => {
    const { attempt, status, modules, currentModuleIndex } = get()

    // Allow operation in review mode (attempt is null) or normal in_progress mode
    const isReviewMode = !attempt && status === 'in_progress'
    const isNormalMode = attempt && status === 'in_progress'

    if (!isReviewMode && !isNormalMode) return

    // Skip database operations in review mode
    if (isReviewMode) return

    // At this point, we know attempt is not null (we're in normal mode)
    if (!attempt) return

    const currentModule = modules[currentModuleIndex]

    try {
      console.log(
        '[SaveModuleAnswers] Starting module completion save as safety fallback'
      )
      // Save all answers for this module (as safety fallback - most answers should already be saved via debounce)
      for (const [questionId, examAnswer] of Object.entries(
        currentModule.answers
      )) {
        const question = currentModule.questions.find(
          (q) => q.id === questionId
        )
        if (question && examAnswer.answer) {
          // Use normalizeCorrectAnswers to handle both grid_in and multiple_choice questions
          const rawCorrectAnswers =
            question.question_type === 'grid_in'
              ? question.correct_answers || [question.correct_answer]
              : question.correct_answer

          // Normalize the correct answers to handle double-encoded JSON
          const normalizedCorrectAnswers =
            normalizeCorrectAnswers(rawCorrectAnswers)

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

          const isCorrect = checkAnswer(
            examAnswer.answer,
            normalizedCorrectAnswers
          )
          console.log(
            `[RESULT] Comparison result for Question ID ${question.id}: ${isCorrect}`
          )

          await ExamService.submitAnswer({
            attempt_id: attempt.id,
            question_id: questionId,
            user_answer: examAnswer.answer,
            is_correct: isCorrect,
            time_spent_seconds: examAnswer.timeSpent,
          })
        }
      }
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  nextQuestion: () => {
    const { modules, currentModuleIndex, saveCurrentAnswerImmediately } = get()
    const currentModule = modules[currentModuleIndex]
    const nextQuestionIndex = currentModule.currentQuestionIndex + 1

    if (nextQuestionIndex >= currentModule.questions.length) {
      // Should not happen - use nextModule instead
      return
    }

    // Save current answer immediately before moving
    saveCurrentAnswerImmediately()

    const newModules = [...modules]
    newModules[currentModuleIndex] = {
      ...newModules[currentModuleIndex],
      currentQuestionIndex: nextQuestionIndex,
    }

    set({
      modules: newModules,
      currentQuestionStartTime: Date.now(), // Reset timer for new question
    })
  },

  previousQuestion: () => {
    const { modules, currentModuleIndex, saveCurrentAnswerImmediately } = get()
    const currentModule = modules[currentModuleIndex]
    const prevQuestionIndex = currentModule.currentQuestionIndex - 1

    if (prevQuestionIndex < 0) {
      // Can't go before first question in module
      return
    }

    // Save current answer immediately before moving
    saveCurrentAnswerImmediately()

    const newModules = [...modules]
    newModules[currentModuleIndex] = {
      ...newModules[currentModuleIndex],
      currentQuestionIndex: prevQuestionIndex,
    }

    set({
      modules: newModules,
      currentQuestionStartTime: Date.now(), // Reset timer for new question
    })
  },

  goToQuestion: (questionIndex: number) => {
    const { modules, currentModuleIndex, saveCurrentAnswerImmediately } = get()
    const currentModule = modules[currentModuleIndex]

    if (questionIndex < 0 || questionIndex >= currentModule.questions.length) {
      // Invalid question index
      return
    }

    // Save current answer immediately before moving
    saveCurrentAnswerImmediately()

    const newModules = [...modules]
    newModules[currentModuleIndex] = {
      ...newModules[currentModuleIndex],
      currentQuestionIndex: questionIndex,
    }

    set({
      modules: newModules,
      currentQuestionStartTime: Date.now(), // Reset timer for new question
    })
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
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        throw new Error('Authentication error: Could not get user session')
      }

      console.log('✅ User session obtained, submitting to Edge Function')

      // Use the new Edge Function to calculate and store final scores with proper headers
      const { data: finalScores, error } = await supabase.functions.invoke(
        'submit-exam',
        {
          body: JSON.stringify({ attempt_id: attempt.id }),
        }
      )

      if (error) {
        console.error('❌ Edge Function error:', error)
        throw new Error(`Failed to submit exam: ${error.message}`)
      }

      if (!finalScores) {
        throw new Error('No scores returned from submission')
      }

      console.log('✅ Final scores received:', finalScores)

      // Clean up highlights from localStorage
      localStorage.removeItem(`highlights_${attempt.id}`)

      set({
        status: 'completed',
        finalScores, // Store the server-calculated scores in state
      })
    } catch (err: any) {
      console.error('💥 Complete exam error:', err)
      set({ error: err.message })
      throw err
    }
  },

  completeReviewSession: async (originalAttemptId: string) => {
    console.log('🎯 Starting review session completion process...')

    const { modules } = get()
    if (modules.length === 0) {
      throw new Error('No review modules found')
    }

    const reviewModule = modules[0] // Review mode has only one module

    try {
      // Collect all answers from the review session
      const newAnswers = Object.entries(reviewModule.answers).map(
        ([questionId, examAnswer]) => ({
          questionId,
          answer: examAnswer.answer,
        })
      )

      console.log(
        `🚀 Calling calculate-potential-score Server Action for ${newAnswers.length} answers`
      )

      // Call the Server Action - much simpler and more reliable than Edge Function
      const { calculatePotentialScore } = await import('@/lib/exam-actions')

      const result = await calculatePotentialScore({
        originalAttemptId,
        newAnswers,
      })

      if (!result.success) {
        console.error('❌ Server Action failed:', result.error)
        throw new Error(result.error || 'Failed to calculate potential score')
      }

      console.log('✅ Server Action succeeded:', result)

      console.log('✅ Potential score calculated:', result)

      set({
        status: 'completed',
        finalScores: {
          overall: result.potentialScore || 0,
          english: 0, // Not applicable for review mode
          math: 0, // Not applicable for review mode
        },
      })

      return {
        success: true,
        potentialScore: result.potentialScore,
        originalScore: result.originalScore,
        improvement: result.improvement,
      }
    } catch (err: any) {
      console.error('💥 Complete review session error:', err)
      set({ error: err.message })
      throw err
    }
  },

  nextModule: async () => {
    const {
      attempt,
      currentModuleIndex,
      modules,
      saveModuleAnswers,
      completeExam,
    } = get()

    console.log('nextModule called:', {
      hasAttempt: !!attempt,
      currentModuleIndex,
      totalModules: modules.length,
    })

    if (!attempt) {
      console.error('No attempt found, cannot advance module')
      return
    }

    const nextModuleIndex = currentModuleIndex + 1
    console.log('Attempting to advance to module index:', nextModuleIndex)

    try {
      // Note: Answers are now saved in real-time via debounce, so no need for bulk save here
      console.log(
        'Real-time saving ensures answers are already saved, proceeding to next module...'
      )

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
        current_question_number: 1,
      })
      console.log('Database updated successfully')

      const newModules = [...modules]
      // Mark current module as completed
      newModules[currentModuleIndex] = {
        ...newModules[currentModuleIndex],
        completed: true,
      }

      // Reset the next module's timer to full time
      if (newModules[nextModuleIndex]) {
        newModules[nextModuleIndex] = {
          ...newModules[nextModuleIndex],
          timeRemaining: newModules[nextModuleIndex].timeLimit * 60, // Reset to full time in seconds
        }
      }

      console.log('Updating exam state to module index:', nextModuleIndex)
      set({
        modules: newModules,
        currentModuleIndex: nextModuleIndex,
        currentQuestionStartTime: Date.now(), // Reset timer for first question of new module
        status: 'in_progress', // Reset status from 'time_expired' back to 'in_progress'
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
      isLastModule: currentModuleIndex >= modules.length - 1,
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
      timeRemaining: remainingSeconds,
    }

    set({ modules: newModules })
  },

  getCurrentQuestion: () => {
    const { modules, currentModuleIndex } = get()

    if (modules.length === 0 || currentModuleIndex >= modules.length) {
      return null
    }

    const currentModule = modules[currentModuleIndex]
    if (
      !currentModule ||
      !currentModule.questions ||
      currentModule.questions.length === 0
    ) {
      return null
    }

    const question =
      currentModule.questions[currentModule.currentQuestionIndex] || null
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
        markedForReview: newMarkedForReview,
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
        isMarked: currentModule.markedForReview.has(question.id),
      }))
      .filter((item) => item.isMarked)
  },

  continueExistingAttempt: async () => {
    const { existingAttempt, exam } = get()
    if (!existingAttempt || !exam) return

    console.log('continueExistingAttempt: Starting with', {
      existingAttempt,
      exam: exam.title,
    })

    set({ loading: true })
    try {
      // Load existing answers for this attempt
      const existingAnswers = await ExamService.getUserAnswers(
        existingAttempt.id
      )
      console.log(
        'continueExistingAttempt: Found existing answers:',
        existingAnswers.length
      )

      // Load questions for all modules
      const moduleStates: ModuleState[] = []

      for (const moduleType of MODULE_ORDER) {
        const questions = await ExamService.getQuestions(exam.id, moduleType)
        const timeLimit = exam.time_limits[moduleType] || 60

        console.log(
          `continueExistingAttempt: Module ${moduleType} has ${questions.length} questions`
        )

        // Skip modules with no questions
        if (questions.length === 0) {
          console.warn(
            `continueExistingAttempt: Skipping module ${moduleType} - no questions found`
          )
          continue
        }

        // Build answers map for this module from existing database answers
        const moduleAnswers: Record<string, ExamAnswer> = {}
        existingAnswers.forEach((answer) => {
          const question = questions.find((q) => q.id === answer.question_id)
          if (question && answer.user_answer) {
            moduleAnswers[answer.question_id] = {
              questionId: answer.question_id,
              answer: answer.user_answer,
              timeSpent: answer.time_spent_seconds,
              answeredAt: new Date(answer.answered_at),
            }
          }
        })

        // Determine if this module is completed (has answers for all questions)
        const isCompleted =
          questions.length > 0 && questions.every((q) => moduleAnswers[q.id])

        // Set current question index based on the existing attempt's current question number
        let currentQuestionIndex = 0
        if (moduleType === existingAttempt.current_module) {
          currentQuestionIndex = Math.max(
            0,
            (existingAttempt.current_question_number || 1) - 1
          )
        } else if (isCompleted) {
          currentQuestionIndex = questions.length - 1
        }

        console.log(`continueExistingAttempt: Module ${moduleType} setup:`, {
          questionsLength: questions.length,
          answersCount: Object.keys(moduleAnswers).length,
          isCompleted,
          currentQuestionIndex,
        })

        moduleStates.push({
          module: moduleType,
          questions,
          currentQuestionIndex,
          answers: moduleAnswers,
          markedForReview: new Set(),
          timeLimit,
          timeRemaining: timeLimit * 60,
          completed: isCompleted,
        })
      }

      // Ensure we have at least one module with questions
      if (moduleStates.length === 0) {
        throw new Error('No questions found for any module in this exam')
      }

      // Find current module index based on existing attempt (within the filtered modules)
      const attemptCurrentModule = existingAttempt.current_module || 'english1'
      const currentModuleIndex = moduleStates.findIndex(
        (module) => module.module === attemptCurrentModule
      )
      const validCurrentModuleIndex =
        currentModuleIndex >= 0 ? currentModuleIndex : 0

      console.log('continueExistingAttempt: Final state setup:', {
        attemptCurrentModule,
        currentModuleIndex: validCurrentModuleIndex,
        modulesCount: moduleStates.length,
        availableModules: moduleStates.map((m) => m.module),
        status: existingAttempt.status,
      })

      // If the existing attempt was expired, reactivate it
      if (existingAttempt.status === 'expired') {
        console.log('continueExistingAttempt: Reactivating expired attempt')
        await ExamService.updateTestAttempt(existingAttempt.id, {
          status: 'in_progress',
        })
      }

      // Load highlights from localStorage
      const savedHighlightsJSON = localStorage.getItem(
        `highlights_${existingAttempt.id}`
      )
      let savedHighlights = {}
      if (savedHighlightsJSON) {
        try {
          savedHighlights = JSON.parse(savedHighlightsJSON)
        } catch (e) {
          console.error('Failed to parse saved highlights:', e)
        }
      }

      set({
        exam,
        attempt: existingAttempt,
        modules: moduleStates,
        currentModuleIndex: validCurrentModuleIndex,
        status: 'in_progress', // Always set to in_progress when continuing
        startedAt: existingAttempt.started_at
          ? new Date(existingAttempt.started_at)
          : null,
        existingAttempt: null,
        showConflictModal: false,
        loading: false,
        highlightsByQuestion: savedHighlights,
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
      // Clean up highlights for the existing attempt
      localStorage.removeItem(`highlights_${existingAttempt.id}`)

      // Delete existing attempt
      await ExamService.deleteTestAttempt(existingAttempt.id)

      // Get current session for Authorization header
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      // Add Authorization header with access token
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
        console.log(
          'discardAndStartNew: Added Authorization header with access token'
        )
      } else {
        console.warn(
          'discardAndStartNew: No access token available for Authorization header'
        )
      }

      // Create new test attempt
      const response = await fetch('/api/test-attempts', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          exam_id: exam.id,
          status: 'not_started',
          current_module: 'english1',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create test attempt')
      }

      const attempt = await response.json()

      // Load questions for all modules
      const moduleStates: ModuleState[] = []

      for (const moduleType of MODULE_ORDER) {
        const questions = await ExamService.getQuestions(exam.id, moduleType)
        const timeLimit = exam.time_limits[moduleType] || 60

        console.log(
          `discardAndStartNew: Module ${moduleType} has ${questions.length} questions`
        )

        // Skip modules with no questions
        if (questions.length === 0) {
          console.warn(
            `discardAndStartNew: Skipping module ${moduleType} - no questions found`
          )
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
          completed: false,
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
        loading: false,
        highlightsByQuestion: {},
      })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  closeConflictModal: (router?: any) => {
    set({
      showConflictModal: false,
      existingAttempt: null,
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
      error: null,
      highlightsByQuestion: {},
    })
  },

  addHighlight: (questionId: string, newHighlight: Highlight) => {
    const { highlightsByQuestion, attempt } = get()

    const newHighlights = { ...highlightsByQuestion }
    if (!newHighlights[questionId]) {
      newHighlights[questionId] = []
    }

    // Add the new highlight and sort by start position
    newHighlights[questionId].push(newHighlight)
    newHighlights[questionId].sort((a, b) => a.start - b.start)

    // Update React state for immediate UI re-render
    set({ highlightsByQuestion: newHighlights })

    // Persist to localStorage
    if (attempt?.id) {
      localStorage.setItem(
        `highlights_${attempt.id}`,
        JSON.stringify(newHighlights)
      )
    }
  },

  removeHighlight: (questionId: string, highlightToRemove: Highlight) => {
    const { highlightsByQuestion, attempt } = get()

    const newHighlights = { ...highlightsByQuestion }
    if (newHighlights[questionId]) {
      newHighlights[questionId] = newHighlights[questionId].filter(
        (h) =>
          h.start !== highlightToRemove.start || h.end !== highlightToRemove.end
      )
      set({ highlightsByQuestion: newHighlights })

      if (attempt?.id) {
        localStorage.setItem(
          `highlights_${attempt.id}`,
          JSON.stringify(newHighlights)
        )
      }
    }
  },

  saveCurrentAnswerImmediately: async () => {
    const {
      attempt,
      status,
      modules,
      currentModuleIndex,
      getCurrentQuestion,
      currentQuestionStartTime,
    } = get()

    // Allow operation in review mode (attempt is null) or normal in_progress mode
    const isReviewMode = !attempt && status === 'in_progress'
    const isNormalMode = attempt && status === 'in_progress'

    if (!isReviewMode && !isNormalMode) return

    const currentModule = modules[currentModuleIndex]
    const currentQuestion = getCurrentQuestion()
    if (!currentQuestion || !currentModule) return

    const currentAnswer = currentModule.answers[currentQuestion.id]?.answer
    if (!currentAnswer || !currentAnswer.trim()) return

    // Calculate time spent
    const timeSpentSeconds =
      currentQuestionStartTime > 0
        ? Math.round((Date.now() - currentQuestionStartTime) / 1000)
        : 0

    // Only save to database in normal mode (not review mode)
    if (attempt) {
      try {
        await saveAnswerImmediately({
          attemptId: attempt.id,
          questionId: currentQuestion.id,
          answer: currentAnswer.trim(),
          timeSpent: timeSpentSeconds,
        })
      } catch (error) {
        console.error(
          '[SaveCurrentAnswerImmediately] Failed to save answer:',
          error
        )
      }
    }
  },
}))
