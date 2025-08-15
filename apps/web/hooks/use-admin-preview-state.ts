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
  completed: boolean
}

interface AdminPreviewState {
  exam: Exam | null
  modules: ModuleState[]
  currentModuleIndex: number
  status: 'not_started' | 'in_progress' | 'completed'
}

const MODULE_ORDER: ModuleType[] = ['english1', 'english2', 'math1', 'math2']

export function useAdminPreviewState() {
  const { user } = useAuth()
  const [examState, setExamState] = useState<AdminPreviewState>({
    exam: null,
    modules: [],
    currentModuleIndex: 0,
    status: 'not_started'
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize exam with questions for admin preview
  const initializeExam = useCallback(async (examId: string) => {
    console.log('Admin Preview: Starting initialization for exam:', examId)
    setLoading(true)
    setError(null)

    try {
      // Get exam details
      console.log('Admin Preview: Fetching exam details...')
      const exam = await ExamService.getExam(examId)
      if (!exam) {
        console.error('Admin Preview: Exam not found')
        throw new Error('Exam not found')
      }
      console.log('Admin Preview: Exam found:', exam.title)

      // Load questions for all modules
      const moduleStates: ModuleState[] = []
      console.log('Admin Preview: Loading questions for all modules...')
      
      for (const moduleType of MODULE_ORDER) {
        console.log(`Admin Preview: Fetching questions for module: ${moduleType}`)
        const questions = await ExamService.getQuestions(examId, moduleType)
        const timeLimit = exam.time_limits[moduleType] || 60

        console.log(`Admin Preview: Module ${moduleType} loaded ${questions.length} questions`)

        // Skip modules with no questions (don't add them to the array)
        if (questions.length === 0) {
          console.warn(`Admin Preview: Skipping module ${moduleType} - no questions found`)
          continue
        }

        moduleStates.push({
          module: moduleType,
          questions,
          currentQuestionIndex: 0,
          answers: {},
          markedForReview: new Set(),
          timeLimit,
          completed: false
        })
      }

      console.log('Admin Preview: Final module states:', moduleStates.length, 'modules loaded')

      // Ensure we have at least one module with questions
      if (moduleStates.length === 0) {
        console.error('Admin Preview: No modules with questions found!')
        throw new Error('No questions found for any module in this exam')
      }

      console.log('Admin Preview: Setting exam state...')
      setExamState({
        exam,
        modules: moduleStates,
        currentModuleIndex: 0,
        status: 'in_progress'
      })
      console.log('Admin Preview: Exam state set successfully')
    } catch (err: any) {
      console.error('Admin Preview: Error occurred:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Store answer locally (for preview purposes only)
  const setLocalAnswer = useCallback((answer: string) => {
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
  
  // Admin: Navigate to any module and question (for preview mode)
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
            
            console.log('📝 Question updated in admin preview state:', updatedQuestion.id)
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

  // Move to next module (admin preview)
  const nextModule = useCallback(() => {
    console.log('Admin Preview: nextModule called:', {
      currentModuleIndex: examState.currentModuleIndex,
      totalModules: examState.modules.length
    })
    
    const nextModuleIndex = examState.currentModuleIndex + 1
    console.log('Admin Preview: Attempting to advance to module index:', nextModuleIndex)
    
    if (nextModuleIndex >= examState.modules.length) {
      // Complete preview
      console.log('Admin Preview: Reached end of modules')
      setExamState(prev => ({ ...prev, status: 'completed' }))
      return
    }

    console.log('Admin Preview: Advancing to module index:', nextModuleIndex)
    
    setExamState(prev => {
      const newModules = [...prev.modules]
      // Mark current module as completed
      newModules[prev.currentModuleIndex] = {
        ...newModules[prev.currentModuleIndex],
        completed: true
      }

      console.log('Admin Preview: Updating state to module index:', nextModuleIndex)
      return {
        ...prev,
        modules: newModules,
        currentModuleIndex: nextModuleIndex
      }
    })
    console.log('Admin Preview: State updated successfully')
  }, [examState])

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
    getMarkedQuestions
  }
}