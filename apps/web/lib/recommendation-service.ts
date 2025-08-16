import { supabase } from './supabase'
import { ModuleType } from './exam-service'

export interface WrongAnswer {
  questionId: string
  questionNumber: number
  moduleType: ModuleType
  questionText: string
  userAnswer: string | null
  correctAnswer: string
  difficulty: 'easy' | 'medium' | 'hard'
  topicTags: string[]
  explanation: string | null
  attemptedAt: string
  timeSpent: number
  mistakeCount: number // How many times this type of question was missed
}

export interface StudyRecommendation {
  type: 'topic' | 'difficulty' | 'module' | 'time_management'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  actionItems: string[]
  estimatedStudyTime: number // in minutes
  relatedQuestions: string[] // question IDs for practice
}

export interface WeaknessAnalysis {
  weakTopics: Array<{
    topic: string
    questionsAttempted: number
    questionsCorrect: number
    accuracyRate: number
    avgDifficulty: number
    recentMistakes: number
  }>
  difficultyStruggles: {
    easy: { attempted: number; correct: number; rate: number }
    medium: { attempted: number; correct: number; rate: number }
    hard: { attempted: number; correct: number; rate: number }
  }
  moduleWeaknesses: Array<{
    module: ModuleType
    accuracyRate: number
    avgTimePerQuestion: number
    commonMistakes: string[]
  }>
  timeManagementIssues: {
    tooSlow: boolean
    tooFast: boolean
    avgTimePerQuestion: number
    recommendedTime: number
  }
}

export class RecommendationService {
  // Get all wrong answers for a student across all attempts
  static async getStudentWrongAnswers(
    userId: string,
    limit?: number
  ): Promise<WrongAnswer[]> {
    const { data, error } = await supabase
      .from('user_answers')
      .select(
        `
        *,
        questions:question_id (*),
        test_attempts:attempt_id (completed_at, user_id)
      `
      )
      .eq('is_correct', false)
      .eq('test_attempts.user_id', userId)
      .order('answered_at', { ascending: false })
      .limit(limit || 100)

    if (error) throw error

    return (data || []).map((answer) => ({
      questionId: answer.question_id,
      questionNumber: answer.questions.question_number,
      moduleType: answer.questions.module_type,
      questionText: answer.questions.question_text,
      userAnswer: answer.user_answer,
      correctAnswer: answer.questions.correct_answer,
      difficulty: answer.questions.difficulty_level,
      topicTags: answer.questions.topic_tags || [],
      explanation: answer.questions.explanation,
      attemptedAt: answer.answered_at,
      timeSpent: answer.time_spent_seconds,
      mistakeCount: 1, // Would need aggregation for actual count
    }))
  }

  // Analyze student weaknesses and patterns
  static async analyzeWeaknesses(userId: string): Promise<WeaknessAnalysis> {
    const wrongAnswers = await this.getStudentWrongAnswers(userId)
    const allAnswers = await this.getAllStudentAnswers(userId)

    // Topic analysis
    const topicStats: Record<
      string,
      {
        attempted: number
        correct: number
        difficulties: number[]
        recent: number
      }
    > = {}

    allAnswers.forEach((answer) => {
      const question = answer.questions
      if (question && question.topic_tags) {
        question.topic_tags.forEach((topic: string) => {
          if (!topicStats[topic]) {
            topicStats[topic] = {
              attempted: 0,
              correct: 0,
              difficulties: [],
              recent: 0,
            }
          }
          topicStats[topic].attempted++
          topicStats[topic].difficulties.push(
            this.difficultyToNumber(question.difficulty_level)
          )

          if (answer.is_correct) {
            topicStats[topic].correct++
          } else {
            // Check if this is a recent mistake (last 30 days)
            const answerDate = new Date(answer.answered_at)
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            if (answerDate > thirtyDaysAgo) {
              topicStats[topic].recent++
            }
          }
        })
      }
    })

    const weakTopics = Object.entries(topicStats)
      .map(([topic, stats]) => ({
        topic,
        questionsAttempted: stats.attempted,
        questionsCorrect: stats.correct,
        accuracyRate:
          stats.attempted > 0 ? (stats.correct / stats.attempted) * 100 : 0,
        avgDifficulty:
          stats.difficulties.length > 0
            ? stats.difficulties.reduce((sum, d) => sum + d, 0) /
              stats.difficulties.length
            : 0,
        recentMistakes: stats.recent,
      }))
      .filter(
        (topic) => topic.accuracyRate < 70 && topic.questionsAttempted >= 3
      )
      .sort((a, b) => a.accuracyRate - b.accuracyRate)

    // Difficulty analysis
    const difficultyStats = {
      easy: { attempted: 0, correct: 0, rate: 0 },
      medium: { attempted: 0, correct: 0, rate: 0 },
      hard: { attempted: 0, correct: 0, rate: 0 },
    }

    allAnswers.forEach((answer) => {
      const difficulty = answer.questions?.difficulty_level
      if (difficulty && difficulty in difficultyStats) {
        const diffKey = difficulty as keyof typeof difficultyStats
        difficultyStats[diffKey].attempted++
        if (answer.is_correct) {
          difficultyStats[diffKey].correct++
        }
      }
    })

    Object.keys(difficultyStats).forEach((key) => {
      const diff = difficultyStats[key as keyof typeof difficultyStats]
      diff.rate = diff.attempted > 0 ? (diff.correct / diff.attempted) * 100 : 0
    })

    // Module analysis
    const moduleStats: Record<
      ModuleType,
      {
        attempted: number
        correct: number
        timeSpent: number
        mistakes: string[]
      }
    > = {
      english1: { attempted: 0, correct: 0, timeSpent: 0, mistakes: [] },
      english2: { attempted: 0, correct: 0, timeSpent: 0, mistakes: [] },
      math1: { attempted: 0, correct: 0, timeSpent: 0, mistakes: [] },
      math2: { attempted: 0, correct: 0, timeSpent: 0, mistakes: [] },
    }

    allAnswers.forEach((answer) => {
      const question = answer.questions
      if (question) {
        const module = question.module_type as ModuleType
        moduleStats[module].attempted++
        moduleStats[module].timeSpent += answer.time_spent_seconds || 0

        if (answer.is_correct) {
          moduleStats[module].correct++
        } else {
          // Add common mistake patterns
          if (question.topic_tags) {
            moduleStats[module].mistakes.push(...question.topic_tags)
          }
        }
      }
    })

    const moduleWeaknesses = Object.entries(moduleStats)
      .map(([module, stats]) => ({
        module: module as ModuleType,
        accuracyRate:
          stats.attempted > 0 ? (stats.correct / stats.attempted) * 100 : 0,
        avgTimePerQuestion:
          stats.attempted > 0 ? stats.timeSpent / stats.attempted : 0,
        commonMistakes: [...new Set(stats.mistakes)].slice(0, 5),
      }))
      .filter((module) => module.accuracyRate < 75)

    // Time management analysis
    const totalTime = allAnswers.reduce(
      (sum, a) => sum + (a.time_spent_seconds || 0),
      0
    )
    const avgTimePerQuestion =
      allAnswers.length > 0 ? totalTime / allAnswers.length : 0
    const recommendedTime = 90 // 1.5 minutes per question in seconds

    const timeManagementIssues = {
      tooSlow: avgTimePerQuestion > recommendedTime * 1.5,
      tooFast: avgTimePerQuestion < recommendedTime * 0.5,
      avgTimePerQuestion,
      recommendedTime,
    }

    return {
      weakTopics,
      difficultyStruggles: difficultyStats,
      moduleWeaknesses,
      timeManagementIssues,
    }
  }

  // Generate personalized study recommendations
  static async generateRecommendations(
    userId: string
  ): Promise<StudyRecommendation[]> {
    const weaknessAnalysis = await this.analyzeWeaknesses(userId)
    const recommendations: StudyRecommendation[] = []

    // Topic-based recommendations
    weaknessAnalysis.weakTopics.slice(0, 3).forEach((topic) => {
      recommendations.push({
        type: 'topic',
        priority:
          topic.accuracyRate < 50
            ? 'high'
            : topic.accuracyRate < 65
              ? 'medium'
              : 'low',
        title: `Master ${topic.topic}`,
        description: `You've answered ${topic.accuracyRate.toFixed(1)}% of ${topic.topic} questions correctly. Focus on understanding the core concepts.`,
        actionItems: [
          `Review ${topic.topic} fundamentals`,
          `Practice 10-15 ${topic.topic} questions daily`,
          `Analyze mistakes in ${topic.topic} problems`,
          `Seek additional resources for ${topic.topic}`,
        ],
        estimatedStudyTime: Math.max(
          30,
          Math.round((100 - topic.accuracyRate) * 2)
        ),
        relatedQuestions: [], // Would be populated with relevant question IDs
      })
    })

    // Difficulty-based recommendations
    Object.entries(weaknessAnalysis.difficultyStruggles).forEach(
      ([difficulty, stats]) => {
        if (stats.rate < 70 && stats.attempted >= 5) {
          recommendations.push({
            type: 'difficulty',
            priority:
              difficulty === 'easy'
                ? 'high'
                : difficulty === 'medium'
                  ? 'medium'
                  : 'low',
            title: `Improve ${difficulty} question accuracy`,
            description: `Your accuracy on ${difficulty} questions is ${stats.rate.toFixed(1)}%. ${
              difficulty === 'easy'
                ? 'Focus on avoiding careless mistakes and time management.'
                : difficulty === 'medium'
                  ? 'Build deeper understanding of core concepts.'
                  : 'Develop advanced problem-solving strategies.'
            }`,
            actionItems: [
              `Practice 5-10 ${difficulty} questions daily`,
              `Review solution strategies for ${difficulty} problems`,
              difficulty === 'easy'
                ? 'Double-check answers before submitting'
                : 'Work through step-by-step solutions',
              `Time yourself on ${difficulty} questions`,
            ],
            estimatedStudyTime:
              difficulty === 'easy' ? 20 : difficulty === 'medium' ? 40 : 60,
            relatedQuestions: [],
          })
        }
      }
    )

    // Module-based recommendations
    weaknessAnalysis.moduleWeaknesses.forEach((module) => {
      const moduleNames = {
        english1: 'Reading and Writing',
        english2: 'Writing and Language',
        math1: 'Math (No Calculator)',
        math2: 'Math (Calculator)',
      }

      recommendations.push({
        type: 'module',
        priority: module.accuracyRate < 60 ? 'high' : 'medium',
        title: `Strengthen ${moduleNames[module.module]}`,
        description: `Your ${moduleNames[module.module]} accuracy is ${module.accuracyRate.toFixed(1)}%. Common weak areas: ${module.commonMistakes.slice(0, 3).join(', ')}.`,
        actionItems: [
          `Complete focused ${moduleNames[module.module]} practice sections`,
          `Review mistakes in previous ${moduleNames[module.module]} tests`,
          `Study ${moduleNames[module.module]} strategy guides`,
          `Take timed ${moduleNames[module.module]} practice tests`,
        ],
        estimatedStudyTime: Math.round((100 - module.accuracyRate) * 1.5),
        relatedQuestions: [],
      })
    })

    // Time management recommendations
    if (
      weaknessAnalysis.timeManagementIssues.tooSlow ||
      weaknessAnalysis.timeManagementIssues.tooFast
    ) {
      recommendations.push({
        type: 'time_management',
        priority: 'medium',
        title: weaknessAnalysis.timeManagementIssues.tooSlow
          ? 'Improve Time Management'
          : 'Slow Down and Check Work',
        description: weaknessAnalysis.timeManagementIssues.tooSlow
          ? `You're spending ${Math.round(weaknessAnalysis.timeManagementIssues.avgTimePerQuestion)} seconds per question on average. Aim for ${weaknessAnalysis.timeManagementIssues.recommendedTime} seconds.`
          : `You're working too quickly at ${Math.round(weaknessAnalysis.timeManagementIssues.avgTimePerQuestion)} seconds per question. Take time to avoid careless errors.`,
        actionItems: weaknessAnalysis.timeManagementIssues.tooSlow
          ? [
              'Practice with strict time limits',
              'Learn to quickly eliminate wrong answers',
              'Skip difficult questions and return later',
              'Practice mental math and quick calculations',
            ]
          : [
              'Read questions more carefully',
              'Double-check your work',
              'Practice mindful test-taking',
              'Allocate time to review answers',
            ],
        estimatedStudyTime: 30,
        relatedQuestions: [],
      })
    }

    // Sort by priority and return top recommendations
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return recommendations
      .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
      .slice(0, 6) // Return top 6 recommendations
  }

  // Get practice questions for specific weaknesses
  static async getPracticeQuestions(
    userId: string,
    topicFilter?: string,
    difficultyFilter?: 'easy' | 'medium' | 'hard',
    moduleFilter?: ModuleType,
    limit: number = 10
  ): Promise<any[]> {
    let query = supabase.from('questions').select('*').limit(limit)

    // Apply filters
    if (topicFilter) {
      query = query.contains('topic_tags', [topicFilter])
    }

    if (difficultyFilter) {
      query = query.eq('difficulty_level', difficultyFilter)
    }

    if (moduleFilter) {
      query = query.eq('module_type', moduleFilter)
    }

    // Exclude questions the user has already answered correctly recently
    const { data: recentCorrect } = await supabase
      .from('user_answers')
      .select('question_id')
      .eq('is_correct', true)
      .gte(
        'answered_at',
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      ) // Last 30 days

    if (recentCorrect && recentCorrect.length > 0) {
      const correctIds = recentCorrect.map((r) => r.question_id)
      query = query.not('id', 'in', `(${correctIds.join(',')})`)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  // Helper methods
  private static async getAllStudentAnswers(userId: string) {
    const { data, error } = await supabase
      .from('user_answers')
      .select(
        `
        *,
        questions:question_id (*),
        test_attempts:attempt_id (user_id)
      `
      )
      .eq('test_attempts.user_id', userId)

    if (error) throw error
    return data || []
  }

  private static difficultyToNumber(difficulty: string): number {
    switch (difficulty) {
      case 'easy':
        return 1
      case 'medium':
        return 2
      case 'hard':
        return 3
      default:
        return 2
    }
  }

  // Create a wrong answer review session
  static async createReviewSession(
    userId: string,
    topicFilter?: string
  ): Promise<WrongAnswer[]> {
    let wrongAnswers = await this.getStudentWrongAnswers(userId, 20)

    if (topicFilter) {
      wrongAnswers = wrongAnswers.filter((answer) =>
        answer.topicTags.includes(topicFilter)
      )
    }

    // Prioritize recent mistakes and commonly missed topics
    wrongAnswers.sort((a, b) => {
      const aDate = new Date(a.attemptedAt).getTime()
      const bDate = new Date(b.attemptedAt).getTime()
      return bDate - aDate // Most recent first
    })

    return wrongAnswers.slice(0, 10) // Return top 10 for review
  }
}
