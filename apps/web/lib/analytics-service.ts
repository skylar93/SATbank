import { ModuleType, Question, UserAnswer, TestAttempt, ExamService } from './exam-service'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface DetailedScore {
  totalScore: number           // 400-1600
  evidenceBasedReading: number // 200-800 (English 1)
  mathScore: number           // 200-800 (Math 1 + Math 2)
  writingLanguage: number     // Combined with reading for EBRW
  rawScores: {
    english1: number
    english2: number
    math1: number
    math2: number
  }
  percentages: {
    english1: number
    english2: number
    math1: number
    math2: number
    overall: number
  }
  percentiles: {
    english1: number
    english2: number
    math1: number
    math2: number
    overall: number
  }
}

export interface QuestionAnalysis {
  questionId: string
  questionNumber: number
  moduleType: ModuleType
  userAnswer: string | null
  correctAnswer: string | string[]
  isCorrect: boolean
  timeSpent: number
  difficulty: 'easy' | 'medium' | 'hard'
  topicTags: string[]
  explanation: string | null
  questionText: string
  options: Record<string, string> | null
  questionImageUrl: string | null
}

export interface PerformanceAnalytics {
  totalQuestions: number
  correctAnswers: number
  accuracyRate: number
  averageTimePerQuestion: number
  totalTimeSpent: number
  strengthAreas: string[]
  weaknessAreas: string[]
  difficultyBreakdown: {
    easy: { attempted: number; correct: number; percentage: number }
    medium: { attempted: number; correct: number; percentage: number }
    hard: { attempted: number; correct: number; percentage: number }
  }
  topicPerformance: Array<{
    topic: string
    attempted: number
    correct: number
    percentage: number
  }>
}

export interface ComprehensiveResults {
  attempt: TestAttempt
  detailedScore: DetailedScore
  questionAnalysis: QuestionAnalysis[]
  performanceAnalytics: PerformanceAnalytics
  progressComparison?: {
    previousAttempts: number
    scoreImprovement: number
    accuracyImprovement: number
  }
}

export class AnalyticsService {
  // SAT score conversion tables (simplified - real SAT uses complex curves)
  private static readonly SCORE_CONVERSION = {
    // Raw score to scaled score conversion (approximate)
    reading: [200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300, 310, 320, 330, 340, 350, 360, 370, 380, 390, 400, 410, 420, 430, 440, 450, 460, 470, 480, 490, 500, 510, 520, 530, 540, 550, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650, 660, 670, 680, 690, 700, 720, 740, 760, 780, 800],
    math: [200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300, 310, 320, 330, 340, 350, 360, 370, 380, 390, 400, 410, 420, 430, 440, 450, 460, 470, 480, 490, 500, 510, 520, 530, 540, 550, 560, 570, 580, 590, 600, 610, 620, 630, 640, 650, 660, 670, 680, 690, 700, 720, 740, 760, 780, 800]
  }

  // Calculate comprehensive results for a test attempt
  static async getComprehensiveResults(attemptId: string): Promise<ComprehensiveResults> {
    const [attempt, answers, questions] = await Promise.all([
      this.getTestAttempt(attemptId),
      this.getUserAnswersWithQuestions(attemptId),
      this.getAllQuestionsForAttempt(attemptId)
    ])

    if (!attempt) {
      throw new Error('Test attempt not found')
    }

    // Use actual final_scores if available, otherwise fall back to calculation
    const detailedScore = attempt.final_scores 
      ? this.buildDetailedScoreFromFinalScores(attempt.final_scores, answers, questions)
      : this.calculateDetailedScore(answers, questions)
    
    const questionAnalysis = this.buildQuestionAnalysis(answers, questions)
    const performanceAnalytics = this.calculatePerformanceAnalytics(answers, questions)
    const progressComparison = await this.calculateProgressComparison(attempt.user_id, attemptId)

    return {
      attempt,
      detailedScore,
      questionAnalysis,
      performanceAnalytics,
      progressComparison
    }
  }

  // Build DetailedScore from actual final_scores data
  static buildDetailedScoreFromFinalScores(finalScores: any, answers: any[], questions: Question[]): DetailedScore {
    const moduleStats = {
      english1: { correct: 0, total: 0 },
      english2: { correct: 0, total: 0 },
      math1: { correct: 0, total: 0 },
      math2: { correct: 0, total: 0 }
    }

    // Count correct answers by module for percentages
    answers.forEach(answer => {
      const question = questions.find(q => q.id === answer.question_id)
      if (question) {
        moduleStats[question.module_type].total++
        if (answer.is_correct) {
          moduleStats[question.module_type].correct++
        }
      }
    })

    // Calculate raw scores
    const rawScores = {
      english1: moduleStats.english1.correct,
      english2: moduleStats.english2.correct,
      math1: moduleStats.math1.correct,
      math2: moduleStats.math2.correct
    }

    // Calculate percentages
    const percentages = {
      english1: moduleStats.english1.total > 0 ? (moduleStats.english1.correct / moduleStats.english1.total) * 100 : 0,
      english2: moduleStats.english2.total > 0 ? (moduleStats.english2.correct / moduleStats.english2.total) * 100 : 0,
      math1: moduleStats.math1.total > 0 ? (moduleStats.math1.correct / moduleStats.math1.total) * 100 : 0,
      math2: moduleStats.math2.total > 0 ? (moduleStats.math2.correct / moduleStats.math2.total) * 100 : 0,
      overall: 0
    }

    const totalCorrect = Object.values(rawScores).reduce((sum, score) => sum + score, 0)
    const totalQuestions = Object.values(moduleStats).reduce((sum, stat) => sum + stat.total, 0)
    percentages.overall = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0

    // Calculate percentiles (simplified)
    const percentiles = {
      english1: this.calculatePercentile(percentages.english1),
      english2: this.calculatePercentile(percentages.english2),
      math1: this.calculatePercentile(percentages.math1),
      math2: this.calculatePercentile(percentages.math2),
      overall: this.calculatePercentile(percentages.overall)
    }

    return {
      totalScore: finalScores.overall,
      evidenceBasedReading: finalScores.english,
      mathScore: finalScores.math,
      writingLanguage: finalScores.english, // Same as evidenceBasedReading for now
      rawScores,
      percentages,
      percentiles
    }
  }

  // Enhanced score calculation with SAT-like scoring (fallback)
  static calculateDetailedScore(answers: any[], questions: Question[]): DetailedScore {
    const moduleStats = {
      english1: { correct: 0, total: 0 },
      english2: { correct: 0, total: 0 },
      math1: { correct: 0, total: 0 },
      math2: { correct: 0, total: 0 }
    }

    // Count correct answers by module
    answers.forEach(answer => {
      const question = questions.find(q => q.id === answer.question_id)
      if (question) {
        moduleStats[question.module_type].total++
        if (answer.is_correct) {
          moduleStats[question.module_type].correct++
        }
      }
    })

    // Calculate raw scores
    const rawScores = {
      english1: moduleStats.english1.correct,
      english2: moduleStats.english2.correct,
      math1: moduleStats.math1.correct,
      math2: moduleStats.math2.correct
    }

    // Calculate percentages
    const percentages = {
      english1: moduleStats.english1.total > 0 ? (moduleStats.english1.correct / moduleStats.english1.total) * 100 : 0,
      english2: moduleStats.english2.total > 0 ? (moduleStats.english2.correct / moduleStats.english2.total) * 100 : 0,
      math1: moduleStats.math1.total > 0 ? (moduleStats.math1.correct / moduleStats.math1.total) * 100 : 0,
      math2: moduleStats.math2.total > 0 ? (moduleStats.math2.correct / moduleStats.math2.total) * 100 : 0,
      overall: 0
    }

    const totalCorrect = Object.values(rawScores).reduce((sum, score) => sum + score, 0)
    const totalQuestions = Object.values(moduleStats).reduce((sum, stat) => sum + stat.total, 0)
    percentages.overall = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0

    // Convert to SAT-like scores (simplified conversion)
    const readingScore = this.convertToSATScore(rawScores.english1, moduleStats.english1.total, 'reading')
    const mathCombined = rawScores.math1 + rawScores.math2
    const mathTotal = moduleStats.math1.total + moduleStats.math2.total
    const mathScore = this.convertToSATScore(mathCombined, mathTotal, 'math')
    
    // Evidence-Based Reading and Writing (EBRW) combines English 1 & 2
    const writingScore = this.convertToSATScore(rawScores.english2, moduleStats.english2.total, 'reading')
    const evidenceBasedReading = Math.round((readingScore + writingScore) / 2)

    const totalScore = evidenceBasedReading + mathScore

    // Calculate percentiles (simplified - would need historical data for accurate percentiles)
    const percentiles = {
      english1: this.calculatePercentile(percentages.english1),
      english2: this.calculatePercentile(percentages.english2),
      math1: this.calculatePercentile(percentages.math1),
      math2: this.calculatePercentile(percentages.math2),
      overall: this.calculatePercentile(percentages.overall)
    }

    return {
      totalScore,
      evidenceBasedReading,
      mathScore,
      writingLanguage: writingScore,
      rawScores,
      percentages,
      percentiles
    }
  }

  // Convert raw score to SAT-like scaled score
  private static convertToSATScore(correct: number, total: number, section: 'reading' | 'math'): number {
    if (total === 0) return 200
    
    const percentage = correct / total
    const conversionTable = this.SCORE_CONVERSION[section]
    const index = Math.min(Math.floor(percentage * (conversionTable.length - 1)), conversionTable.length - 1)
    
    return conversionTable[index]
  }

  // Calculate percentile (simplified)
  private static calculatePercentile(percentage: number): number {
    // Simplified percentile calculation - in reality this would use historical data
    if (percentage >= 95) return 99
    if (percentage >= 90) return 95
    if (percentage >= 85) return 90
    if (percentage >= 80) return 85
    if (percentage >= 75) return 75
    if (percentage >= 70) return 65
    if (percentage >= 65) return 55
    if (percentage >= 60) return 45
    if (percentage >= 55) return 35
    if (percentage >= 50) return 25
    if (percentage >= 40) return 15
    if (percentage >= 30) return 10
    return 5
  }

  // Build question-by-question analysis
  private static buildQuestionAnalysis(answers: any[], questions: Question[]): QuestionAnalysis[] {
    return answers.map(answer => {
      const question = questions.find(q => q.id === answer.question_id)
      if (!question) {
        throw new Error(`Question not found for answer ${answer.id}`)
      }

      return {
        questionId: question.id,
        questionNumber: question.question_number,
        moduleType: question.module_type,
        userAnswer: answer.user_answer,
        correctAnswer: question.correct_answer,
        isCorrect: answer.is_correct || false,
        timeSpent: answer.time_spent_seconds || 0,
        difficulty: question.difficulty_level,
        topicTags: question.topic_tags || [],
        explanation: question.explanation,
        questionText: question.question_text,
        options: question.options,
        questionImageUrl: question.question_image_url
      }
    }).sort((a, b) => a.questionNumber - b.questionNumber)
  }

  // Calculate performance analytics
  private static calculatePerformanceAnalytics(answers: any[], questions: Question[]): PerformanceAnalytics {
    const totalQuestions = answers.length
    const correctAnswers = answers.filter(a => a.is_correct).length
    const accuracyRate = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0
    const totalTimeSpent = answers.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0)
    const averageTimePerQuestion = totalQuestions > 0 ? totalTimeSpent / totalQuestions : 0

    // Difficulty breakdown
    const difficultyBreakdown = {
      easy: { attempted: 0, correct: 0, percentage: 0 },
      medium: { attempted: 0, correct: 0, percentage: 0 },
      hard: { attempted: 0, correct: 0, percentage: 0 }
    }

    answers.forEach(answer => {
      const question = questions.find(q => q.id === answer.question_id)
      if (question) {
        const difficulty = question.difficulty_level
        difficultyBreakdown[difficulty].attempted++
        if (answer.is_correct) {
          difficultyBreakdown[difficulty].correct++
        }
      }
    })

    // Calculate percentages for difficulty
    Object.keys(difficultyBreakdown).forEach(key => {
      const diff = difficultyBreakdown[key as keyof typeof difficultyBreakdown]
      diff.percentage = diff.attempted > 0 ? (diff.correct / diff.attempted) * 100 : 0
    })

    // Topic performance
    const topicStats: Record<string, { attempted: number; correct: number }> = {}
    
    answers.forEach(answer => {
      const question = questions.find(q => q.id === answer.question_id)
      if (question && question.topic_tags) {
        question.topic_tags.forEach(topic => {
          if (!topicStats[topic]) {
            topicStats[topic] = { attempted: 0, correct: 0 }
          }
          topicStats[topic].attempted++
          if (answer.is_correct) {
            topicStats[topic].correct++
          }
        })
      }
    })

    const topicPerformance = Object.entries(topicStats).map(([topic, stats]) => ({
      topic,
      attempted: stats.attempted,
      correct: stats.correct,
      percentage: stats.attempted > 0 ? (stats.correct / stats.attempted) * 100 : 0
    })).sort((a, b) => b.percentage - a.percentage)

    // Identify strengths and weaknesses
    const strengthAreas = topicPerformance.filter(t => t.percentage >= 80).map(t => t.topic)
    const weaknessAreas = topicPerformance.filter(t => t.percentage < 60).map(t => t.topic)

    return {
      totalQuestions,
      correctAnswers,
      accuracyRate,
      averageTimePerQuestion,
      totalTimeSpent,
      strengthAreas,
      weaknessAreas,
      difficultyBreakdown,
      topicPerformance
    }
  }

  // Get test attempt details
  private static async getTestAttempt(attemptId: string): Promise<TestAttempt | null> {
    const { data, error } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('id', attemptId)
      .single()

    if (error) throw error
    return data
  }

  // Get user answers with question details
  private static async getUserAnswersWithQuestions(attemptId: string) {
    const { data, error } = await supabase
      .from('user_answers')
      .select('*')
      .eq('attempt_id', attemptId)

    if (error) throw error
    return data || []
  }

  // Get all questions for the attempt
  private static async getAllQuestionsForAttempt(attemptId: string): Promise<Question[]> {
    const { data, error } = await supabase
      .from('user_answers')
      .select(`
        question_id,
        questions:question_id (*)
      `)
      .eq('attempt_id', attemptId)

    if (error) throw error
    
    return (data?.map((item: any) => item.questions).filter(Boolean) || []) as Question[]
  }

  // Calculate progress comparison with previous attempts
  private static async calculateProgressComparison(userId: string, currentAttemptId: string) {
    const attempts = await ExamService.getUserAttempts(userId)
    const completedAttempts = attempts.filter(a => a.status === 'completed' && a.id !== currentAttemptId)
    
    if (completedAttempts.length === 0) {
      return undefined
    }

    const currentAttempt = attempts.find(a => a.id === currentAttemptId)
    if (!currentAttempt) return undefined

    const previousAttempts = completedAttempts.length
    const latestPrevious = completedAttempts[0] // Most recent previous attempt
    
    const scoreImprovement = currentAttempt.total_score - (latestPrevious.total_score || 0)
    
    // Calculate accuracy improvement (simplified)
    const accuracyImprovement = 0 // Would need to calculate from detailed answers

    return {
      previousAttempts,
      scoreImprovement,
      accuracyImprovement
    }
  }

  // Get analytics for admin dashboard
  static async getAdminAnalytics() {
    const { data: attempts, error } = await supabase
      .from('test_attempts')
      .select(`
        *,
        user_profiles:user_id (full_name, email)
      `)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (error) throw error

    return {
      totalAttempts: attempts?.length || 0,
      averageScore: attempts?.reduce((sum, a) => sum + (a.total_score || 0), 0) / (attempts?.length || 1),
      recentAttempts: attempts?.slice(0, 10) || []
    }
  }

  // Dashboard functions - use same approach as results page for consistency
  static async getDashboardOverallStats(userId: string): Promise<{
    examsTaken: number;
    bestScore: number | null;
    averageScore: number | null;
  }> {
    
    // Use ExamService.getUserAttempts() like results page does
    const userAttempts = await ExamService.getUserAttempts(userId)
    
    // Filter completed attempts (same logic as results page)
    const completedAttempts = userAttempts.filter(attempt => 
      attempt.status === 'completed'
    )


    if (!completedAttempts || completedAttempts.length === 0) {
      return { examsTaken: 0, bestScore: null, averageScore: null }
    }

    // Check result visibility for each unique exam (same as results page)
    const uniqueExamIds = [...new Set(completedAttempts.filter(a => a.exam_id).map(a => a.exam_id!))]
    const resultVisibility = new Map<string, boolean>()
    
    await Promise.all(
      uniqueExamIds.map(async (examId) => {
        try {
          const canShow = await ExamService.canShowResults(userId, examId)
          resultVisibility.set(examId, canShow)
        } catch (error) {
          // Default to true for practice mode or if there's an error
          resultVisibility.set(examId, true)
        }
      })
    )


    // Helper function to check if results can be shown for an attempt (same as results page)
    const canShowAttemptResults = (attempt: any): boolean => {
      if (!attempt.exam_id) return true // Practice mode, always show
      return resultVisibility.get(attempt.exam_id) ?? true
    }

    // Helper function to get display score (same as results page)
    const getDisplayScore = (attempt: any): number => {
      return attempt.final_scores?.overall || attempt.total_score || 0
    }

    // Filter visible completed attempts for score calculations
    const visibleCompletedAttempts = completedAttempts.filter(canShowAttemptResults)
    

    // Total exams taken (all completed attempts)
    const examsTaken = completedAttempts.length

    // Calculate scores only from visible attempts
    const scores = visibleCompletedAttempts
      .map(attempt => {
        const score = getDisplayScore(attempt)
        return score
      })
      .filter((score): score is number => {
        const isValid = typeof score === 'number' && score > 0
        return isValid
      })


    const bestScore = scores.length > 0 ? Math.max(...scores) : null
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

    return { examsTaken, bestScore, averageScore }
  }

  static async getDashboardScoreHistory(userId: string): Promise<Array<{
    date: string;
    score: number;
  }>> {
    // Use ExamService.getUserAttempts() like results page does for consistency
    const userAttempts = await ExamService.getUserAttempts(userId)
    
    // Filter completed attempts (same logic as results page)
    const completedAttempts = userAttempts.filter(attempt => 
      attempt.status === 'completed'
    )

    if (!completedAttempts || completedAttempts.length === 0) {
      return []
    }

    // Check result visibility for each unique exam (same as results page)
    const uniqueExamIds = [...new Set(completedAttempts.filter(a => a.exam_id).map(a => a.exam_id!))]
    const resultVisibility = new Map<string, boolean>()
    
    await Promise.all(
      uniqueExamIds.map(async (examId) => {
        try {
          const canShow = await ExamService.canShowResults(userId, examId)
          resultVisibility.set(examId, canShow)
        } catch (error) {
          // Default to true for practice mode or if there's an error
          resultVisibility.set(examId, true)
        }
      })
    )

    // Helper function to check if results can be shown for an attempt (same as results page)
    const canShowAttemptResults = (attempt: any): boolean => {
      if (!attempt.exam_id) return true // Practice mode, always show
      return resultVisibility.get(attempt.exam_id) ?? true
    }

    // Helper function to get display score (same as results page)
    const getDisplayScore = (attempt: any): number => {
      return attempt.final_scores?.overall || attempt.total_score || 0
    }

    // Filter visible completed attempts and return score history
    const visibleCompletedAttempts = completedAttempts.filter(canShowAttemptResults)

    return visibleCompletedAttempts
      .filter(attempt => {
        const score = getDisplayScore(attempt)
        return score > 0 && attempt.completed_at
      })
      .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime())
      .map(attempt => ({
        date: new Date(attempt.completed_at!).toISOString().split('T')[0],
        score: getDisplayScore(attempt)
      }))
  }
}