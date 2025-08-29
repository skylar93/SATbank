// Vocab Bank Types - Based on database schema
export type QuizType = 'term_to_def' | 'def_to_term'
export type QuizFormat = 'multiple_choice' | 'written_answer'

export interface VocabSet {
  id: number
  user_id: string
  title: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface VocabEntry {
  id: number
  set_id: number
  user_id: string
  term: string
  definition: string
  example_sentence: string | null
  image_url: string | null
  mastery_level: number // 0-5 scale for spaced repetition
  last_reviewed_at: string | null
  next_review_date: string
  review_interval: number
  created_at: string
}

export interface QuizSession {
  id: string
  user_id: string
  set_id: number
  quiz_type: QuizType
  quiz_format: QuizFormat
  score_percentage: number | null
  questions_total: number
  questions_correct: number
  completed_at: string
}

// Insert types (omitting auto-generated fields)
export type NewVocabSet = Omit<VocabSet, 'id' | 'created_at' | 'updated_at'>
export type NewVocabEntry = Omit<VocabEntry, 'id' | 'created_at'>
export type NewQuizSession = Omit<QuizSession, 'id' | 'completed_at'>

// Update types (partial, omitting non-updatable fields)
export type UpdateVocabSet = Partial<
  Omit<VocabSet, 'id' | 'user_id' | 'created_at' | 'updated_at'>
>
export type UpdateVocabEntry = Partial<
  Omit<VocabEntry, 'id' | 'set_id' | 'user_id' | 'created_at'>
>
export type UpdateQuizSession = Partial<
  Omit<QuizSession, 'id' | 'user_id' | 'set_id'>
>

// Specialized types for specific operations
export interface BulkWord {
  term: string
  definition: string
}

export interface SRSUpdateParams {
  entryId: number
  isCorrect: boolean
}

export interface SmartReviewWord extends VocabEntry {
  vocab_sets: {
    title: string
  }
}

export interface QuizResult {
  entryId: number
  setId: number
  wasCorrect: boolean
}

// Response types for server actions
export interface VocabActionResponse {
  success: boolean
  message?: string
}

export interface BulkAddResponse extends VocabActionResponse {
  count?: number
}

export interface SmartReviewResponse extends VocabActionResponse {
  words?: SmartReviewWord[]
}

export interface SmartReviewCountResponse extends VocabActionResponse {
  count?: number
}

export interface CreateSetResponse extends VocabActionResponse {
  setId?: number
}

export interface ProcessQuizResultsResponse extends VocabActionResponse {
  processedCount?: number
  totalCount?: number
  errors?: string[]
}

// Import SRS configuration from external config file
export { srsConfig as SRS_CONFIG } from '@/config/vocab.config'
