import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type ModuleType = 'english1' | 'english2' | 'math1' | 'math2'

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
  question_type: 'multiple_choice' | 'grid_in' | 'essay'
  difficulty_level: 'easy' | 'medium' | 'hard'
  question_text: string
  question_image_url: string | null
  options: Record<string, string> | null
  correct_answer: string
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
  status: 'not_started' | 'in_progress' | 'completed' | 'expired'
  current_module: ModuleType | null
  current_question_number: number
  started_at: string | null
  completed_at: string | null
  expires_at: string | null
  time_spent: Record<ModuleType, number> | null
  total_score: number
  module_scores: Record<ModuleType, number> | null
  is_practice_mode: boolean
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

export interface CreateTestAttempt {
  user_id: string
  exam_id: string
  status?: 'not_started' | 'in_progress' | 'completed' | 'expired'
  current_module?: ModuleType | null
  is_practice_mode?: boolean
}

export interface CreateUserAnswer {
  attempt_id: string
  question_id: string
  user_answer: string | null
  is_correct?: boolean | null
  time_spent_seconds?: number
}

export class ExamService {
  // Get all active exams
  static async getActiveExams(): Promise<Exam[]> {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Get exam by ID
  static async getExam(examId: string): Promise<Exam | null> {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single()

    if (error) throw error
    return data
  }

  // Get questions for exam module
  static async getQuestions(examId: string, moduleType: ModuleType): Promise<Question[]> {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('exam_id', examId)
      .eq('module_type', moduleType)
      .order('question_number', { ascending: true })

    if (error) throw error
    return data || []
  }

  // Create new test attempt
  static async createTestAttempt(attempt: CreateTestAttempt): Promise<TestAttempt> {
    const { data, error } = await supabase
      .from('test_attempts')
      .insert(attempt)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Get user's test attempts
  static async getUserAttempts(userId: string, examId?: string): Promise<TestAttempt[]> {
    let query = supabase
      .from('test_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (examId) {
      query = query.eq('exam_id', examId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  // Update test attempt
  static async updateTestAttempt(attemptId: string, updates: Partial<TestAttempt>): Promise<TestAttempt> {
    const { data, error } = await supabase
      .from('test_attempts')
      .update(updates)
      .eq('id', attemptId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Submit answer
  static async submitAnswer(answer: CreateUserAnswer): Promise<UserAnswer> {
    const { data, error } = await supabase
      .from('user_answers')
      .upsert(answer, { onConflict: 'attempt_id,question_id' })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Get user answers for attempt
  static async getUserAnswers(attemptId: string): Promise<UserAnswer[]> {
    const { data, error } = await supabase
      .from('user_answers')
      .select('*')
      .eq('attempt_id', attemptId)
      .order('answered_at', { ascending: true })

    if (error) throw error
    return data || []
  }

  // Calculate and update scores
  static async calculateScore(attemptId: string): Promise<{ totalScore: number; moduleScores: Record<ModuleType, number> }> {
    // Get all answers for this attempt with question details
    const { data: answers, error } = await supabase
      .from('user_answers')
      .select(`
        *,
        questions:question_id (
          module_type,
          points,
          correct_answer
        )
      `)
      .eq('attempt_id', attemptId)

    if (error) throw error

    let totalScore = 0
    const moduleScores: Record<ModuleType, number> = {
      english1: 0,
      english2: 0,
      math1: 0,
      math2: 0
    }

    answers?.forEach((answer: any) => {
      if (answer.is_correct) {
        const points = answer.questions.points || 1
        totalScore += points
        moduleScores[answer.questions.module_type as ModuleType] += points
      }
    })

    // Update the test attempt with scores
    await this.updateTestAttempt(attemptId, {
      total_score: totalScore,
      module_scores: moduleScores
    })

    return { totalScore, moduleScores }
  }

  // Complete test attempt
  static async completeTestAttempt(attemptId: string): Promise<TestAttempt> {
    // Calculate final scores
    await this.calculateScore(attemptId)

    // Mark as completed
    return await this.updateTestAttempt(attemptId, {
      status: 'completed',
      completed_at: new Date().toISOString()
    })
  }
}