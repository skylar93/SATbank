'use client'

import { useState, useCallback, useEffect } from 'react'
import { ExamService, type Question, type Exam, type TestAttempt, type ModuleType } from '../lib/exam-service'
import { useAuth } from '../contexts/auth-context'

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
  timeLimit: number // minutes
  timeRemaining: number // seconds
  completed: boolean
}

interface ExamState {
  exam: Exam | null
  attempt: TestAttempt | null
  modules: ModuleState[]
  currentModuleIndex: number
  status: 'not_started' | 'in_progress' | 'completed' | 'expired'
  startedAt: Date | null
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
    startedAt: null
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize exam with questions
  const initializeExam = useCallback(async (examId: string) => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      // Get exam details
      const exam = await ExamService.getExam(examId)
      if (!exam) throw new Error('Exam not found')

      // Create test attempt
      const attempt = await ExamService.createTestAttempt({
        user_id: user.id,
        exam_id: examId,
        status: 'not_started',
        current_module: 'english1'
      })

      // Load questions for all modules
      const moduleStates: ModuleState[] = []
      
      for (const moduleType of MODULE_ORDER) {
        const questions = await ExamService.getQuestions(examId, moduleType)
        const timeLimit = exam.time_limits[moduleType] || 60

        moduleStates.push({
          module: moduleType,
          questions,
          currentQuestionIndex: 0,
          answers: {},
          timeLimit,
          timeRemaining: timeLimit * 60, // Convert to seconds
          completed: false
        })
      }

      setExamState({
        exam,
        attempt,
        modules: moduleStates,
        currentModuleIndex: 0,
        status: 'not_started',
        startedAt: null
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Start the exam
  const startExam = useCallback(async () => {
    if (!examState.attempt) return

    try {
      await ExamService.updateTestAttempt(examState.attempt.id, {
        status: 'in_progress',
        started_at: new Date().toISOString(),
        current_module: 'english1'
      })

      setExamState(prev => ({
        ...prev,
        status: 'in_progress',
        startedAt: new Date()
      }))
    } catch (err: any) {
      setError(err.message)
    }
  }, [examState.attempt])

  // Submit answer for current question
  const submitAnswer = useCallback(async (answer: string) => {
    if (!examState.attempt || examState.status !== 'in_progress') return

    const currentModule = examState.modules[examState.currentModuleIndex]
    const currentQuestion = currentModule.questions[currentModule.currentQuestionIndex]
    
    if (!currentQuestion) return

    try {
      // Calculate if answer is correct
      const isCorrect = answer.toLowerCase() === currentQuestion.correct_answer.toLowerCase()

      // Submit to database
      await ExamService.submitAnswer({
        attempt_id: examState.attempt.id,
        question_id: currentQuestion.id,
        user_answer: answer,
        is_correct: isCorrect,
        time_spent_seconds: 0 // Will be updated with actual time tracking
      })

      // Update local state
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
    } catch (err: any) {
      setError(err.message)
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

  // Move to next module
  const nextModule = useCallback(async () => {
    if (!examState.attempt) return

    const nextModuleIndex = examState.currentModuleIndex + 1
    
    if (nextModuleIndex >= examState.modules.length) {
      // Complete exam
      await completeExam()
      return
    }

    try {
      const nextModule = MODULE_ORDER[nextModuleIndex]
      
      // Update attempt in database
      await ExamService.updateTestAttempt(examState.attempt.id, {
        current_module: nextModule,
        current_question_number: 1
      })

      setExamState(prev => {
        const newModules = [...prev.modules]
        // Mark current module as completed
        newModules[prev.currentModuleIndex] = {
          ...newModules[prev.currentModuleIndex],
          completed: true
        }

        return {
          ...prev,
          modules: newModules,
          currentModuleIndex: nextModuleIndex
        }
      })
    } catch (err: any) {
      setError(err.message)
    }
  }, [examState])

  // Complete exam
  const completeExam = useCallback(async () => {
    if (!examState.attempt) return

    try {
      await ExamService.completeTestAttempt(examState.attempt.id)

      setExamState(prev => ({
        ...prev,
        status: 'completed'
      }))
    } catch (err: any) {
      setError(err.message)
    }
  }, [examState.attempt])

  // Handle timer expiration for current module
  const handleTimeExpired = useCallback(async () => {
    // Auto-advance to next module or complete exam
    if (examState.currentModuleIndex < examState.modules.length - 1) {
      await nextModule()
    } else {
      await completeExam()
    }
  }, [examState.currentModuleIndex, examState.modules.length, nextModule, completeExam])

  // Update timer for current module
  const updateTimer = useCallback((remainingSeconds: number) => {
    setExamState(prev => {
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
  }, [examState.currentModuleIndex])

  // Get current question
  const getCurrentQuestion = useCallback(() => {
    const currentModule = examState.modules[examState.currentModuleIndex]
    if (!currentModule) return null
    
    return currentModule.questions[currentModule.currentQuestionIndex] || null
  }, [examState.modules, examState.currentModuleIndex])

  // Get current answer
  const getCurrentAnswer = useCallback(() => {
    const currentQuestion = getCurrentQuestion()
    if (!currentQuestion) return undefined

    const currentModule = examState.modules[examState.currentModuleIndex]
    return currentModule.answers[currentQuestion.id]?.answer
  }, [examState.modules, examState.currentModuleIndex, getCurrentQuestion])

  return {
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
  }
}