// Re-export core types from exam-service for centralized access
export type {
  ModuleType,
  Exam,
  Question,
  TestAttempt,
  UserAnswer,
  CreateTestAttempt,
} from './exam-service'

// Import for use in interfaces below
import type { ModuleType, Exam, Question } from './exam-service'

// Admin Dashboard Types
export interface AdminStats {
  totalStudents: number
  totalAttempts: number
  averageScore: number
  completedToday: number
  weeklyTrend: Array<{ label: string; value: number; date: string }>
  scoreDistribution: Array<{ label: string; value: number }>
  studentsTrend: number[]
  attemptsTrend: number[]
  scoreTrend: number[]
}

// User Profile Types
export interface UserProfile {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'student'
  created_at: string
  updated_at: string
}

// Exam Assignment Types
export interface ExamAssignment {
  id: string
  exam_id: string
  student_id: string
  assigned_at: string
  due_date: string | null
  completed_at: string | null
  exam?: Exam
  user_profiles?: UserProfile
}

// Student Types
export interface Student {
  id: string
  full_name: string
  email: string
  created_at: string
  updated_at: string
}

// Analytics Types
export interface ExamAnalytics {
  exam_id: string
  exam_title: string
  total_attempts: number
  completed_attempts: number
  average_score: number
  pass_rate: number
  difficulty_metrics: {
    easy_questions_correct: number
    medium_questions_correct: number
    hard_questions_correct: number
  }
}

export interface QuestionAnalytics {
  question_id: string
  question_number: number
  module_type: ModuleType
  total_attempts: number
  correct_attempts: number
  success_rate: number
  average_time_spent: number
  difficulty_level: 'easy' | 'medium' | 'hard'
}

// Scoring Curve Types
export interface ScoringCurve {
  id: number
  curve_name: string
  curve_data: {
    raw: number
    lower: number
    upper: number
  }[]
  created_at: string
  updated_at: string
}

// API Response Types
export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  error: string | null
}

// Form Types
export interface ExamFormData {
  title: string
  description: string
  is_mock_exam: boolean
  time_limits: {
    english1: number
    english2: number
    math1: number
    math2: number
  }
  english_scoring_curve_id: number | null
  math_scoring_curve_id: number | null
}

export interface QuestionFormData {
  question_text: string
  question_type: 'multiple_choice' | 'grid_in' | 'essay'
  difficulty_level: 'easy' | 'medium' | 'hard'
  options: Record<string, any> | null
  correct_answer: string
  correct_answers: string[] | null
  explanation: string
  points: number
  topic_tags: string[]
}

// Table Data Types (for question-display components)
export interface TableData {
  headers: string[]
  rows: string[][]
}

export interface OptionData {
  text?: string
  imageUrl?: string
  headers?: string[]
  rows?: string[][]
  table_data?: TableData
}

// Error Types
export interface FormError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: FormError[]
}

// Loading States
export interface LoadingState {
  isLoading: boolean
  error: string | null
}

// Search and Filter Types
export interface SearchFilters {
  query: string
  module_type: ModuleType | 'all'
  difficulty_level: 'easy' | 'medium' | 'hard' | 'all'
  question_type: 'multiple_choice' | 'grid_in' | 'essay' | 'all'
}

// Mistake Bank Types
export interface MistakeEntry {
  id: string
  user_id: string
  question_id: string
  status: 'unmastered' | 'mastered'
  first_mistaken_at: string
  last_reviewed_at: string | null
  questions?: Question
}

export interface MistakeWithQuestion extends MistakeEntry {
  questions: Question
}

// Export utility type for event handlers
export type EventHandler<T = void> = (
  event?: React.MouseEvent | React.FormEvent
) => T | Promise<T>
export type ChangeHandler<T = string> = (value: T) => void
