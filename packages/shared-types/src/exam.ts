import type { ModuleType, ExamStatus } from '@satbank/database-types'

export interface ExamConfig {
  modules: ModuleType[]
  timePerModule: Record<ModuleType, number> // minutes
  questionsPerModule: Record<ModuleType, number>
}

export interface ExamProgress {
  currentModule: ModuleType
  currentQuestion: number
  timeRemaining: number // seconds
  questionsAnswered: number
  totalQuestions: number
}

export interface ExamTimer {
  startTime: Date
  endTime: Date
  timeElapsed: number // seconds
  timeRemaining: number // seconds
  isExpired: boolean
}

export interface ExamSession {
  attemptId: string
  examId: string
  userId: string
  status: ExamStatus
  progress: ExamProgress
  timer: ExamTimer
}