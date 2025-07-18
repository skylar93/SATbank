import { supabase } from './supabase'

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

  // Update a question
  static async updateQuestion(questionId: string, updates: Partial<Question>): Promise<Question> {
    const { data, error } = await supabase
      .from('questions')
      .update(updates)
      .eq('id', questionId)
      .select()
      .single()

    if (error) throw error
    return data
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

  // Check for existing in-progress or expired attempt for specific exam
  static async getInProgressAttempt(userId: string, examId: string): Promise<TestAttempt | null> {
    const { data, error } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('exam_id', examId)
      .in('status', ['in_progress', 'expired'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) throw error
    return data?.[0] || null
  }

  // Delete test attempt and cleanup orphaned not_started attempts
  static async deleteTestAttempt(attemptId: string): Promise<void> {
    // Get the attempt details before deletion to clean up related attempts
    const { data: attemptData } = await supabase
      .from('test_attempts')
      .select('user_id, exam_id')
      .eq('id', attemptId)
      .single()

    // First delete all associated user answers
    const { error: answersError } = await supabase
      .from('user_answers')
      .delete()
      .eq('attempt_id', attemptId)

    if (answersError) throw answersError

    // Then delete the test attempt
    const { error } = await supabase
      .from('test_attempts')
      .delete()
      .eq('id', attemptId)

    if (error) throw error

    // Clean up any orphaned not_started attempts for the same user/exam
    if (attemptData) {
      await supabase
        .from('test_attempts')
        .delete()
        .eq('user_id', attemptData.user_id)
        .eq('exam_id', attemptData.exam_id)
        .eq('status', 'not_started')
    }
  }

  // Clean up duplicate in_progress attempts for same exam (keep only the most recent)
  static async cleanupDuplicateAttempts(userId: string, examId: string): Promise<void> {
    try {
      // Get all in_progress/not_started attempts for this user and exam
      const { data: attempts, error } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('user_id', userId)
        .eq('exam_id', examId)
        .in('status', ['not_started', 'in_progress'])
        .order('created_at', { ascending: false })

      if (error) throw error

      if (attempts && attempts.length > 1) {
        // Keep the most recent, delete the rest
        const attemptsToDelete = attempts.slice(1)
        for (const attempt of attemptsToDelete) {
          await this.deleteTestAttempt(attempt.id)
        }
      }
    } catch (error) {
      console.error('Error cleaning up duplicate attempts:', error)
      // Don't throw error as this is cleanup - continue with normal flow
    }
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

  // Get dashboard statistics for user
  static async getDashboardStats(userId: string): Promise<{
    examsTaken: number
    bestScore: number | null
    recentAttempts: TestAttempt[]
  }> {
    try {
      // Get all completed attempts for user
      const { data: completedAttempts, error } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })

      if (error) throw error

      const attempts = completedAttempts || []
      const examsTaken = attempts.length
      const bestScore = attempts.length > 0 
        ? Math.max(...attempts.map(attempt => attempt.total_score || 0))
        : null
      const recentAttempts = attempts.slice(0, 5) // Last 5 attempts

      return {
        examsTaken,
        bestScore,
        recentAttempts
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      return {
        examsTaken: 0,
        bestScore: null,
        recentAttempts: []
      }
    }
  }
}