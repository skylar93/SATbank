'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  ExamService,
  type Question,
  type Exam,
  type TestAttempt,
  type ModuleType,
} from '../lib/exam-service'
import { useAuth } from '../contexts/auth-context'
import { checkAnswer } from '../lib/answer-checker'
import { supabase } from '../lib/supabase'
import { devLogger } from '../lib/logger'

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
  completed: boolean
}

interface AdminPreviewState {
  exam: Exam | null
  modules: ModuleState[]
  currentModuleIndex: number
  status: 'not_started' | 'in_progress' | 'completed'
}

const MODULE_ORDER: ModuleType[] = ['english1', 'english2', 'math1', 'math2', 'tcf_reading']

export function useAdminPreviewState() {
  const { user } = useAuth()
  const [examState, setExamState] = useState<AdminPreviewState>({
    exam: null,
    modules: [],
    currentModuleIndex: 0,
    status: 'not_started',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize exam with questions for admin preview
  const initializeExam = useCallback(async (examId: string) => {
    setLoading(true)
    setError(null)

    try {
      // Get exam details
      const exam = await ExamService.getExam(examId)
      if (!exam) {
        throw new Error('Exam not found')
      }

      // Load questions for all modules
      const moduleStates: ModuleState[] = []

      for (const moduleType of MODULE_ORDER) {
        const questions = await ExamService.getQuestions(examId, moduleType)
        const timeLimit = exam.time_limits[moduleType] || 60

        // Skip modules with no questions (don't add them to the array)
        if (questions.length === 0) {
          devLogger.warn(
            `Admin Preview: Skipping module ${moduleType} - no questions found`
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
          completed: false,
        })
      }

      // Ensure we have at least one module with questions
      if (moduleStates.length === 0) {
        throw new Error('No questions found for any module in this exam')
      }

      setExamState({
        exam,
        modules: moduleStates,
        currentModuleIndex: 0,
        status: 'in_progress',
      })
    } catch (err: any) {
      devLogger.error('Admin Preview: Error occurred:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Store answer locally (for preview purposes only)
  const setLocalAnswer = useCallback((answer: string) => {
    setExamState((prev) => {
      const currentModule = prev.modules[prev.currentModuleIndex]
      const currentQuestion =
        currentModule?.questions[currentModule.currentQuestionIndex]

      if (!currentQuestion) return prev

      // Update local state only
      const examAnswer: ExamAnswer = {
        questionId: currentQuestion.id,
        answer,
        timeSpent: 0,
        answeredAt: new Date(),
      }

      const newModules = [...prev.modules]
      newModules[prev.currentModuleIndex] = {
        ...newModules[prev.currentModuleIndex],
        answers: {
          ...newModules[prev.currentModuleIndex].answers,
          [currentQuestion.id]: examAnswer,
        },
      }

      return {
        ...prev,
        modules: newModules,
      }
    })
  }, []) // Empty dependency array since we use functional updates

  // Move to next question
  const nextQuestion = useCallback(() => {
    setExamState((prev) => {
      const currentModule = prev.modules[prev.currentModuleIndex]
      const nextQuestionIndex = currentModule.currentQuestionIndex + 1

      if (nextQuestionIndex >= currentModule.questions.length) {
        // Should not happen - use nextModule instead
        return prev
      }

      const newModules = [...prev.modules]
      newModules[prev.currentModuleIndex] = {
        ...newModules[prev.currentModuleIndex],
        currentQuestionIndex: nextQuestionIndex,
      }

      return {
        ...prev,
        modules: newModules,
      }
    })
  }, [])

  // Move to previous question (within same module only)
  const previousQuestion = useCallback(() => {
    setExamState((prev) => {
      const currentModule = prev.modules[prev.currentModuleIndex]
      const prevQuestionIndex = currentModule.currentQuestionIndex - 1

      if (prevQuestionIndex < 0) {
        // Can't go before first question in module
        return prev
      }

      const newModules = [...prev.modules]
      newModules[prev.currentModuleIndex] = {
        ...newModules[prev.currentModuleIndex],
        currentQuestionIndex: prevQuestionIndex,
      }

      return {
        ...prev,
        modules: newModules,
      }
    })
  }, [])

  // Navigate to specific question within current module
  const goToQuestion = useCallback((questionIndex: number) => {
    setExamState((prev) => {
      const currentModule = prev.modules[prev.currentModuleIndex]

      if (
        questionIndex < 0 ||
        questionIndex >= currentModule.questions.length
      ) {
        // Invalid question index
        return prev
      }

      const newModules = [...prev.modules]
      newModules[prev.currentModuleIndex] = {
        ...newModules[prev.currentModuleIndex],
        currentQuestionIndex: questionIndex,
      }

      return {
        ...prev,
        modules: newModules,
      }
    })
  }, [])

  // Admin: Navigate to any module and question (for preview mode)
  const goToModuleAndQuestion = useCallback(
    (moduleIndex: number, questionIndex: number) => {
      setExamState((prev) => {
        if (moduleIndex < 0 || moduleIndex >= prev.modules.length) {
          // Invalid module index
          return prev
        }

        const targetModule = prev.modules[moduleIndex]
        if (
          questionIndex < 0 ||
          questionIndex >= targetModule.questions.length
        ) {
          // Invalid question index
          return prev
        }

        const newModules = [...prev.modules]
        newModules[moduleIndex] = {
          ...newModules[moduleIndex],
          currentQuestionIndex: questionIndex,
        }

        return {
          ...prev,
          modules: newModules,
          currentModuleIndex: moduleIndex,
        }
      })
    },
    []
  )

  // Update a question in the cached state after successful save
  const updateQuestionInState = useCallback((updatedQuestion: Question) => {
    setExamState((prev) => {
      const newModules = [...prev.modules]

      // Find the module containing this question
      for (
        let moduleIndex = 0;
        moduleIndex < newModules.length;
        moduleIndex++
      ) {
        const module = newModules[moduleIndex]
        if (module.module === updatedQuestion.module_type) {
          // Find the question within this module
          const questionIndex = module.questions.findIndex(
            (q) => q.id === updatedQuestion.id
          )
          if (questionIndex !== -1) {
            // Update the question in the module
            const newQuestions = [...module.questions]
            newQuestions[questionIndex] = updatedQuestion

            newModules[moduleIndex] = {
              ...module,
              questions: newQuestions,
            }

            break
          }
        }
      }

      return {
        ...prev,
        modules: newModules,
      }
    })
  }, [])

  // Move to next module (admin preview)
  const nextModule = useCallback(() => {
    setExamState((prev) => {
      const nextModuleIndex = prev.currentModuleIndex + 1

      if (nextModuleIndex >= prev.modules.length) {
        // Complete preview
        return { ...prev, status: 'completed' }
      }

      const newModules = [...prev.modules]
      // Mark current module as completed
      newModules[prev.currentModuleIndex] = {
        ...newModules[prev.currentModuleIndex],
        completed: true,
      }

      return {
        ...prev,
        modules: newModules,
        currentModuleIndex: nextModuleIndex,
      }
    })
  }, []) // Empty dependency array since we use functional updates

  // Get current question
  const getCurrentQuestion = useCallback(() => {
    if (
      examState.modules.length === 0 ||
      examState.currentModuleIndex >= examState.modules.length
    ) {
      return null
    }

    const currentModule = examState.modules[examState.currentModuleIndex]
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
  }, [examState.modules, examState.currentModuleIndex])

  // Get current answer
  const getCurrentAnswer = useCallback(() => {
    const currentQuestion = getCurrentQuestion()
    if (!currentQuestion) return undefined

    const currentModule = examState.modules[examState.currentModuleIndex]
    return currentModule.answers[currentQuestion.id]?.answer
  }, [examState.modules, examState.currentModuleIndex, getCurrentQuestion])

  // Toggle mark for review
  const toggleMarkForReview = useCallback(
    (questionId?: string) => {
      const currentQuestion = getCurrentQuestion()
      const questionToToggle = questionId || currentQuestion?.id

      if (!questionToToggle) return

      setExamState((prev) => {
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
            markedForReview: newMarkedForReview,
          }
        }

        return {
          ...prev,
          modules: newModules,
        }
      })
    },
    [getCurrentQuestion]
  )

  // Check if current question is marked for review
  const isMarkedForReview = useCallback(
    (questionId?: string) => {
      const currentQuestion = getCurrentQuestion()
      const questionToCheck = questionId || currentQuestion?.id

      if (!questionToCheck) return false

      const currentModule = examState.modules[examState.currentModuleIndex]
      return currentModule?.markedForReview.has(questionToCheck) || false
    },
    [examState.modules, examState.currentModuleIndex, getCurrentQuestion]
  )

  // Get all marked questions in current module
  const getMarkedQuestions = useCallback(() => {
    const currentModule = examState.modules[examState.currentModuleIndex]
    if (!currentModule) return []

    return currentModule.questions
      .map((question, index) => ({
        question,
        index,
        isMarked: currentModule.markedForReview.has(question.id),
      }))
      .filter((item) => item.isMarked)
  }, [examState.modules, examState.currentModuleIndex])

  // Add new question to state optimistically
  const addNewQuestionToState = useCallback((newQuestion: Question) => {
    setExamState((prev) => {
      const newModules = [...prev.modules]

      // Find the module to add the question to
      let moduleIndex = newModules.findIndex(
        (m) => m.module === newQuestion.module_type
      )

      // If module doesn't exist, create it (edge case)
      if (moduleIndex === -1) {
        const timeLimit = prev.exam?.time_limits[newQuestion.module_type] || 60
        newModules.push({
          module: newQuestion.module_type,
          questions: [newQuestion],
          currentQuestionIndex: 0,
          answers: {},
          markedForReview: new Set(),
          timeLimit,
          completed: false,
        })
        moduleIndex = newModules.length - 1
      } else {
        // Add question to existing module
        const updatedModule = { ...newModules[moduleIndex] }
        updatedModule.questions = [...updatedModule.questions, newQuestion]
        newModules[moduleIndex] = updatedModule
      }

      // Navigate to the new question
      const newQuestionIndex = newModules[moduleIndex].questions.length - 1
      newModules[moduleIndex].currentQuestionIndex = newQuestionIndex

      return {
        ...prev,
        modules: newModules,
        currentModuleIndex: moduleIndex,
      }
    })
  }, [])

  return {
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
    getMarkedQuestions,
    addNewQuestionToState,
  }
}
