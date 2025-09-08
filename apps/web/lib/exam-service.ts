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
  question_html?: string | null  // HTML version of question content
  question_image_url: string | null
  options: Record<string, string> | null
  options_html?: Record<string, string> | null  // HTML version of options
  correct_answer: string
  correct_answers: string[] | null
  explanation: string | null
  explanation_html?: string | null  // HTML version of explanation
  points: number
  topic_tags: string[] | null
  table_data?: {
    headers: string[]
    rows: string[][]
  } | null
  content_format?: string  // 'markdown' or 'html' - indicates primary format
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
  final_scores?: {
    overall: number
    english: number
    math: number
  } | null
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
  // Get all active exams (admin view)
  static async getActiveExams(): Promise<Exam[]> {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Get assigned exams for a specific student
  static async getAssignedExams(userId: string): Promise<Exam[]> {
    const { data, error } = await supabase
      .from('exam_assignments')
      .select(
        `
        exams (*)
      `
      )
      .eq('student_id', userId)
      .eq('is_active', true)
      .eq('exams.is_active', true)
      .order('assigned_at', { ascending: false })

    if (error) throw error
    return (
      (data
        ?.map((assignment: any) => assignment.exams as Exam)
        .filter((exam: Exam | null) => exam !== null) as Exam[]) || []
    )
  }

  // Get available exams for a student (only assigned exams)
  static async getAvailableExams(userId: string): Promise<Exam[]> {
    // Only return assigned exams - no automatic mock exam access
    return await this.getAssignedExams(userId)
  }

  // Get available exams with completion status for a student
  static async getAvailableExamsWithStatus(userId: string): Promise<(Exam & { completionStatus: 'not_started' | 'in_progress' | 'completed', completedAttemptId?: string, isCurrentlyAssigned?: boolean })[]> {
    // Get assigned exams
    const assignedExams = await this.getAssignedExams(userId)
    
    // Get all completed exams by this user (including non-assigned ones)
    const { data: completedAttempts, error: attemptsError } = await supabase
      .from('test_attempts')
      .select(`
        id,
        exam_id,
        status,
        completed_at,
        exams (*)
      `)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    if (attemptsError) {
      console.error('Error fetching completed attempts:', attemptsError)
    }

    // Create a set of all unique exam IDs (assigned + completed)
    const assignedExamIds = new Set(assignedExams.map(exam => exam.id))
    const completedExamData = completedAttempts || []
    const allExamIds = new Set([
      ...assignedExamIds,
      ...completedExamData.map(attempt => attempt.exam_id)
    ])

    // Create a map of exam_id -> most recent completed attempt
    const completedAttemptsMap = new Map()
    completedExamData.forEach(attempt => {
      if (!completedAttemptsMap.has(attempt.exam_id) || 
          attempt.completed_at > completedAttemptsMap.get(attempt.exam_id).completed_at) {
        completedAttemptsMap.set(attempt.exam_id, attempt)
      }
    })

    // Build the final list
    const examsWithStatus = await Promise.all(
      Array.from(allExamIds).map(async (examId) => {
        let exam = assignedExams.find(e => e.id === examId)
        const isCurrentlyAssigned = !!exam

        // If not assigned, get exam data from completed attempt
        if (!exam) {
          const completedAttempt = completedAttemptsMap.get(examId)
          exam = completedAttempt?.exams
          if (!exam) return null
        }

        // Get the most recent attempt for this exam (not just completed ones)
        const { data: attempts, error } = await supabase
          .from('test_attempts')
          .select('id, status, completed_at')
          .eq('user_id', userId)
          .eq('exam_id', examId)
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (error) {
          console.error('Error fetching attempt status:', error)
          return {
            ...exam,
            completionStatus: 'not_started' as const,
            isCurrentlyAssigned
          }
        }

        const latestAttempt = attempts?.[0]
        
        if (!latestAttempt) {
          return {
            ...exam,
            completionStatus: 'not_started' as const,
            isCurrentlyAssigned
          }
        }

        return {
          ...exam,
          completionStatus: latestAttempt.status as 'not_started' | 'in_progress' | 'completed',
          completedAttemptId: latestAttempt.status === 'completed' ? latestAttempt.id : undefined,
          isCurrentlyAssigned
        }
      })
    )

    return examsWithStatus.filter(exam => exam !== null)
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

  // Check if a student has access to an exam (is assigned to it or it's a mock exam)
  static async hasExamAccess(userId: string, examId: string): Promise<boolean> {
    // First check if it's a mock exam (available to all students)
    const exam = await this.getExam(examId)
    if (exam?.is_mock_exam) {
      return true
    }

    // Check if student is assigned to the exam
    const { data, error } = await supabase
      .from('exam_assignments')
      .select('id')
      .eq('student_id', userId)
      .eq('exam_id', examId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      throw error
    }

    return !!data
  }

  // Check if results should be shown for a specific assignment
  static async canShowResults(
    userId: string,
    examId: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('exam_assignments')
      .select('show_results')
      .eq('student_id', userId)
      .eq('exam_id', examId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      throw error
    }

    return data?.show_results ?? true // Default to true if not found
  }

  // Get questions for exam module
  static async getQuestions(
    examId: string,
    moduleType: ModuleType
  ): Promise<Question[]> {
    console.log(`🔍 getQuestions: Fetching questions for examId=${examId}, moduleType=${moduleType}`)
    
    // First try direct questions (for regular exams)
    console.log('🔍 getQuestions: Trying direct questions first...')
    const { data: directQuestions, error: directError } = await supabase
      .from('questions')
      .select('*')
      .eq('exam_id', examId)
      .eq('module_type', moduleType)
      .order('question_number', { ascending: true })

    if (directError) {
      console.error('❌ getQuestions: Direct questions query error:', directError)
      throw directError
    }

    console.log(`✅ getQuestions: Found ${directQuestions?.length || 0} direct questions`)

    // If we found direct questions, return them
    if (directQuestions && directQuestions.length > 0) {
      console.log('✅ getQuestions: Returning direct questions')
      return directQuestions
    }

    // If no direct questions, try linked questions (for mistake-based assignments)
    console.log('🔍 getQuestions: No direct questions found, trying linked questions...')
    const { data: linkedQuestions, error: linkedError } = await supabase
      .from('exam_questions')
      .select(
        `
        questions!inner (*)
      `
      )
      .eq('exam_id', examId)
      .eq('questions.module_type', moduleType)

    if (linkedError) {
      console.error('❌ getQuestions: Linked questions query error:', linkedError)
      throw linkedError
    }

    console.log(`✅ getQuestions: Found ${linkedQuestions?.length || 0} linked questions`)

    // Extract questions from the linked results and sort by question_number
    const questions =
      (linkedQuestions
        ?.map((item: any) => item.questions)
        .filter(
          (question: Question | null) => question !== null
        ) as Question[]) || []

    // Sort by question_number since we cannot do it in the query
    questions.sort((a, b) => a.question_number - b.question_number)

    console.log(`✅ getQuestions: Final result: ${questions.length} questions for ${moduleType}`)

    if (questions.length === 0) {
      console.warn(`⚠️ getQuestions: No questions found for examId=${examId}, moduleType=${moduleType}`)
    }

    return questions
  }

  // Update a question
  static async updateQuestion(
    questionId: string,
    updates: Partial<Question>
  ): Promise<Question> {
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
  static async createTestAttempt(
    attempt: CreateTestAttempt,
    supabaseClient?: any
  ): Promise<TestAttempt> {
    const client = supabaseClient || supabase
    const { data, error } = await client
      .from('test_attempts')
      .insert(attempt)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Get user's test attempts with exam details
  static async getUserAttempts(
    userId: string,
    examId?: string
  ): Promise<(TestAttempt & { exam?: Exam })[]> {
    let query = supabase
      .from('test_attempts')
      .select(
        `
        *,
        exam:exams(*)
      `
      )
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
  static async getInProgressAttempt(
    userId: string,
    examId: string
  ): Promise<TestAttempt | null> {
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
  static async cleanupDuplicateAttempts(
    userId: string,
    examId: string
  ): Promise<void> {
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
  static async updateTestAttempt(
    attemptId: string,
    updates: Partial<TestAttempt>
  ): Promise<TestAttempt> {
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

  // Submit answer and mark as viewed (for per-question mode)
  static async submitAnswerWithView(answer: CreateUserAnswer): Promise<{
    userAnswer: UserAnswer
    question: Question
    isCorrect: boolean
  }> {
    // Submit the answer first
    const userAnswer = await this.submitAnswer(answer)

    // Get the question details to check correctness
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', answer.question_id)
      .single()

    if (questionError) throw questionError

    // Check if answer is correct
    const isCorrect = this.checkAnswer(question, answer.user_answer || '')

    // Mark answer as viewed if per-question mode
    const { error: viewError } = await supabase
      .from('user_answers')
      .update({ viewed_correct_answer_at: new Date().toISOString() })
      .eq('attempt_id', answer.attempt_id)
      .eq('question_id', answer.question_id)

    if (viewError) throw viewError

    return {
      userAnswer,
      question,
      isCorrect,
    }
  }

  // Check if answer is correct
  static checkAnswer(question: Question, userAnswer: string): boolean {
    if (!userAnswer || !question.correct_answer) return false

    if (question.question_type === 'grid_in') {
      // For grid-in questions, check against all possible correct answers
      const correctAnswers = question.correct_answers || [
        question.correct_answer,
      ]
      return correctAnswers.some(
        (correct) =>
          String(correct).trim().toLowerCase() ===
          String(userAnswer).trim().toLowerCase()
      )
    }

    // For multiple choice, direct comparison
    return (
      String(question.correct_answer).trim().toLowerCase() ===
      String(userAnswer).trim().toLowerCase()
    )
  }

  // Get exam answer check mode
  static async getExamAnswerMode(
    examId: string
  ): Promise<'exam_end' | 'per_question'> {
    const { data, error } = await supabase
      .from('exams')
      .select('answer_check_mode')
      .eq('id', examId)
      .single()

    if (error) throw error
    return data?.answer_check_mode || 'exam_end'
  }

  // Update exam answer check mode
  static async updateExamAnswerMode(
    examId: string,
    mode: 'exam_end' | 'per_question'
  ): Promise<void> {
    const { error } = await supabase
      .from('exams')
      .update({ answer_check_mode: mode })
      .eq('id', examId)

    if (error) throw error
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
  static async calculateScore(
    attemptId: string
  ): Promise<{ totalScore: number; moduleScores: Record<ModuleType, number> }> {
    // Get all answers for this attempt with question details
    const { data: answers, error } = await supabase
      .from('user_answers')
      .select(
        `
        *,
        questions:question_id (
          module_type,
          points,
          correct_answer
        )
      `
      )
      .eq('attempt_id', attemptId)

    if (error) throw error

    let totalScore = 0
    const moduleScores: Record<ModuleType, number> = {
      english1: 0,
      english2: 0,
      math1: 0,
      math2: 0,
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
      module_scores: moduleScores,
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
      completed_at: new Date().toISOString(),
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
      const bestScore =
        attempts.length > 0
          ? Math.max(...attempts.map((attempt) => attempt.total_score || 0))
          : null
      const recentAttempts = attempts.slice(0, 5) // Last 5 attempts

      return {
        examsTaken,
        bestScore,
        recentAttempts,
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      return {
        examsTaken: 0,
        bestScore: null,
        recentAttempts: [],
      }
    }
  }
}
