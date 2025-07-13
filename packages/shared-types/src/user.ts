import type { UserRole } from '@satbank/database-types'

export interface UserPreferences {
  theme: 'light' | 'dark'
  fontSize: 'small' | 'medium' | 'large'
  showTimer: boolean
  autoSave: boolean
}

export interface UserStats {
  totalExamsTaken: number
  averageScore: number
  bestScore: number
  totalTimeSpent: number // minutes
  modulePerformance: Record<string, {
    averageScore: number
    questionsAnswered: number
    accuracy: number
  }>
}

export interface UserDashboard {
  recentAttempts: Array<{
    examTitle: string
    score: number
    completedAt: string
    duration: number
  }>
  upcomingGoals: Array<{
    targetScore: number
    deadline: string
    progress: number
  }>
  weeklyProgress: Array<{
    date: string
    questionsAnswered: number
    timeSpent: number
  }>
}