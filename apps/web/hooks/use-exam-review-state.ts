'use client'

import { useState, useMemo } from 'react'
import { ModuleType, Question, UserAnswer, TestAttempt, Exam } from '../lib/exam-service'

interface ReviewData {
  attempt: TestAttempt & { exams: Exam }
  exam: Exam
  questions: Question[]
  userAnswers: UserAnswer[]
}

interface ModuleData {
  module: ModuleType
  questions: Question[]
  currentQuestionIndex: number
}

export function useExamReviewState(reviewData: ReviewData) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  // Organize questions by module
  const moduleData = useMemo(() => {
    const modules: Record<ModuleType, Question[]> = {
      english1: [],
      english2: [],
      math1: [],
      math2: [],
    }

    reviewData.questions.forEach((question) => {
      if (question.module_type in modules) {
        modules[question.module_type as ModuleType].push(question)
      }
    })

    return modules
  }, [reviewData.questions])

  // Create a flat array of all questions in order
  const allQuestionsOrdered = useMemo(() => {
    const orderedQuestions: Question[] = []
    const moduleOrder: ModuleType[] = ['english1', 'english2', 'math1', 'math2']
    
    moduleOrder.forEach((moduleType) => {
      const moduleQuestions = moduleData[moduleType] || []
      // Sort by question_number within each module
      const sortedQuestions = [...moduleQuestions].sort((a, b) => a.question_number - b.question_number)
      orderedQuestions.push(...sortedQuestions)
    })
    
    return orderedQuestions
  }, [moduleData])

  // Get current question
  const currentQuestion = allQuestionsOrdered[currentQuestionIndex]

  // Get current module
  const currentModule = currentQuestion?.module_type || 'english1'

  // Total questions count
  const totalQuestions = allQuestionsOrdered.length

  // Get user answer for current question
  const userAnswer = useMemo(() => {
    if (!currentQuestion) return null
    
    const answer = reviewData.userAnswers.find(
      (ua) => ua.question_id === currentQuestion.id
    )
    return answer?.user_answer || null
  }, [currentQuestion, reviewData.userAnswers])

  // Check if current answer is correct
  const isCorrect = useMemo(() => {
    if (!currentQuestion || !userAnswer) return false

    // Handle different question types
    if (currentQuestion.question_type === 'grid_in') {
      // For grid-in questions, check against correct_answers array
      const correctAnswers = currentQuestion.correct_answers || [currentQuestion.correct_answer]
      const userAnswerTrimmed = userAnswer.trim().toUpperCase()
      
      return correctAnswers.some((correctAnswer) => {
        if (Array.isArray(correctAnswer)) {
          return correctAnswer.some((ca) => String(ca).trim().toUpperCase() === userAnswerTrimmed)
        }
        return String(correctAnswer).trim().toUpperCase() === userAnswerTrimmed
      })
    } else {
      // For multiple choice questions
      return userAnswer.trim().toUpperCase() === String(currentQuestion.correct_answer).trim().toUpperCase()
    }
  }, [currentQuestion, userAnswer])

  // Navigation functions
  const nextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const goToQuestion = (questionIndex: number) => {
    if (questionIndex >= 0 && questionIndex < totalQuestions) {
      setCurrentQuestionIndex(questionIndex)
    }
  }

  // Get questions for a specific module
  const getModuleQuestions = (moduleType: ModuleType) => {
    return moduleData[moduleType] || []
  }

  // Get all modules data for navigation
  const getAllModules = (): ModuleData[] => {
    const moduleOrder: ModuleType[] = ['english1', 'english2', 'math1', 'math2']
    
    return moduleOrder
      .filter((moduleType) => (moduleData[moduleType] || []).length > 0)
      .map((moduleType) => ({
        module: moduleType,
        questions: moduleData[moduleType] || [],
        currentQuestionIndex: getCurrentQuestionIndexInModule(moduleType),
      }))
  }

  // Get current question index within the current module
  const getCurrentQuestionIndexInModule = (moduleType: ModuleType) => {
    if (moduleType !== currentModule) return 0
    
    const moduleQuestions = moduleData[moduleType] || []
    const currentQuestionInModule = moduleQuestions.findIndex(
      (q) => q.id === currentQuestion?.id
    )
    
    return Math.max(0, currentQuestionInModule)
  }

  // Get current module index
  const getCurrentModuleIndex = () => {
    const moduleOrder: ModuleType[] = ['english1', 'english2', 'math1', 'math2']
    const modulesWithQuestions = moduleOrder.filter((moduleType) => 
      (moduleData[moduleType] || []).length > 0
    )
    
    return modulesWithQuestions.findIndex((moduleType) => moduleType === currentModule)
  }

  // Calculate correct/incorrect answers for all questions
  const getQuestionResult = (questionIndex: number) => {
    const question = allQuestionsOrdered[questionIndex]
    if (!question) return { hasAnswer: false, isCorrect: false, userAnswer: null }

    const answer = reviewData.userAnswers.find(
      (ua) => ua.question_id === question.id
    )
    const userAnswerValue = answer?.user_answer || null

    if (!userAnswerValue) {
      return { hasAnswer: false, isCorrect: false, userAnswer: null }
    }

    let isQuestionCorrect = false
    if (question.question_type === 'grid_in') {
      const correctAnswers = question.correct_answers || [question.correct_answer]
      const userAnswerTrimmed = userAnswerValue.trim().toUpperCase()
      
      isQuestionCorrect = correctAnswers.some((correctAnswer) => {
        if (Array.isArray(correctAnswer)) {
          return correctAnswer.some((ca) => String(ca).trim().toUpperCase() === userAnswerTrimmed)
        }
        return String(correctAnswer).trim().toUpperCase() === userAnswerTrimmed
      })
    } else {
      isQuestionCorrect = userAnswerValue.trim().toUpperCase() === String(question.correct_answer).trim().toUpperCase()
    }

    return { hasAnswer: true, isCorrect: isQuestionCorrect, userAnswer: userAnswerValue }
  }

  return {
    // State
    currentQuestionIndex,
    currentQuestion,
    currentModule,
    totalQuestions,
    userAnswer,
    isCorrect,
    
    // Navigation
    nextQuestion,
    previousQuestion,
    goToQuestion,
    
    // Data access
    getModuleQuestions,
    getAllModules,
    getCurrentQuestionIndexInModule,
    getCurrentModuleIndex,
    getQuestionResult,
    
    // Raw data
    allQuestionsOrdered,
    moduleData,
    reviewData,
  }
}