// Database Types - Generated from Supabase Schema

export type ModuleType = 'english1' | 'english2' | 'math1' | 'math2'
export type QuestionType = 'multiple_choice' | 'grid_in' | 'essay'
export type DifficultyLevel = 'easy' | 'medium' | 'hard'
export type UserRole = 'student' | 'admin'
export type ExamStatus = 'not_started' | 'in_progress' | 'completed' | 'expired'

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile
        Insert: Omit<UserProfile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>
      }
      exams: {
        Row: Exam
        Insert: Omit<Exam, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Exam, 'id' | 'created_at' | 'updated_at'>>
      }
      questions: {
        Row: Question
        Insert: Omit<Question, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Question, 'id' | 'created_at' | 'updated_at'>>
      }
      test_attempts: {
        Row: TestAttempt
        Insert: Omit<TestAttempt, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<TestAttempt, 'id' | 'created_at' | 'updated_at'>>
      }
      user_answers: {
        Row: UserAnswer
        Insert: Omit<UserAnswer, 'id' | 'answered_at'>
        Update: Partial<Omit<UserAnswer, 'id' | 'answered_at'>>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      should_show_answers: {
        Args: { attempt_id: string }
        Returns: boolean
      }
    }
    Enums: {
      module_type: ModuleType
      question_type: QuestionType
      difficulty_level: DifficultyLevel
      user_role: UserRole
      exam_status: ExamStatus
    }
  }
}

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  grade_level: number | null
  target_score: number | null
  created_at: string
  updated_at: string
}

export interface Exam {
  id: string
  title: string
  description: string | null
  is_mock_exam: boolean
  is_active: boolean
  total_questions: number
  time_limits: {
    english1: number
    english2: number
    math1: number
    math2: number
  }
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  exam_id: string
  module_type: ModuleType
  question_number: number
  question_type: QuestionType
  difficulty_level: DifficultyLevel
  question_text: string
  question_image_url: string | null
  options: Record<string, string> | null // {"A": "text", "B": "text", etc.}
  correct_answer: string // For multiple_choice questions
  correct_answers: string[] | null // For grid_in questions - array of acceptable answers
  explanation: string | null
  points: number
  topic_tags: string[] | null
  created_at: string
  updated_at: string
}

export interface TestAttempt {
  id: string
  user_id: string
  exam_id: string
  status: ExamStatus
  current_module: ModuleType | null
  current_question_number: number
  started_at: string | null
  completed_at: string | null
  expires_at: string | null
  time_spent: Record<ModuleType, number> | null
  total_score: number
  module_scores: Record<ModuleType, number> | null
  is_practice_mode: boolean
  answers_visible: boolean
  answers_visible_after: string | null
  created_at: string
  updated_at: string
}

export interface UserAnswer {
  id: string
  attempt_id: string
  question_id: string
  user_answer: string | null
  is_correct: boolean | null
  time_spent_seconds: number
  answered_at: string
}

// Utility types for common operations
export type CreateUserProfile = Database['public']['Tables']['user_profiles']['Insert']
export type UpdateUserProfile = Database['public']['Tables']['user_profiles']['Update']
export type CreateExam = Database['public']['Tables']['exams']['Insert']
export type UpdateExam = Database['public']['Tables']['exams']['Update']
export type CreateQuestion = Database['public']['Tables']['questions']['Insert']
export type UpdateQuestion = Database['public']['Tables']['questions']['Update']
export type CreateTestAttempt = Database['public']['Tables']['test_attempts']['Insert']
export type UpdateTestAttempt = Database['public']['Tables']['test_attempts']['Update']
export type CreateUserAnswer = Database['public']['Tables']['user_answers']['Insert']
export type UpdateUserAnswer = Database['public']['Tables']['user_answers']['Update']