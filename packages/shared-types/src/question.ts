import type { QuestionType, DifficultyLevel, ModuleType } from '@satbank/database-types'

export interface QuestionOption {
  id: string
  text: string
  isCorrect?: boolean
}

export interface QuestionDisplay {
  id: string
  questionNumber: number
  moduleType: ModuleType
  type: QuestionType
  difficulty: DifficultyLevel
  text: string
  imageUrl?: string
  options?: QuestionOption[]
  userAnswer?: string
  isAnswered: boolean
  timeSpent: number // seconds
}

export interface QuestionValidation {
  isValid: boolean
  errorMessage?: string
}

export interface QuestionResult {
  questionId: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  points: number
  timeSpent: number
  explanation?: string
}