'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../../../contexts/auth-context'
import DashboardClient from '../../../../components/dashboard/DashboardClient'
import {
  ExamService,
  type TestAttempt,
} from '../../../../lib/exam-service'
import { AnalyticsService } from '../../../../lib/analytics-service'
import { WeeklyActivityService } from '../../../../lib/weekly-activity-service'
import { supabase } from '../../../../lib/supabase'
import {
  getTodayReviewCount,
  getVocabSetsWithReviewsDue,
} from '../../../../lib/vocab-service'

interface AssignmentTask {
  assignmentId: string
  examId: string
  examTitle: string
  status: 'not_started' | 'in_progress' | 'completed'
  assignedAt: string | null
  dueDate: string | null
  lastActivityAt: string | null
  isOverdue: boolean
  isDueSoon: boolean
  progressPercent: number
  totalQuestions: number | null
  estimatedMinutes: number | null
}

interface MistakeSummary {
  total: number
  unmastered: number
  mastered: number
  lastReviewedAt: string | null
  countsByExam: Array<{
    examId: string | null
    examTitle: string
    count: number
  }>
  countsByModule: Array<{
    module: string
    count: number
  }>
}

interface VocabSummary {
  dueToday: number
  totalWords: number
  nextReviewAt: string | null
  reviewSets: Array<{
    id: number | string
    title: string
    count: number
  }>
}

interface DashboardData {
  overallStats: {
    examsTaken: number
    bestScore: number | null
    averageScore: number | null
  }
  scoreHistory: Array<{
    date: string
    score: number
  }>
  recentAttempts: TestAttempt[]
  previousMonthStats: {
    examsTaken: number
    bestScore: number | null
    averageScore: number | null
  }
  activityDays: string[]
  weeklyActivity: {
    days: string[]
    studyTime: number[]
    practiceTests: number[]
  }
  subjectScores: {
    reading: number
    writing: number
    math: number
  }
  assignments: AssignmentTask[]
  mistakeSummary: MistakeSummary
  vocabSummary: VocabSummary
}

type DashboardMetrics = Omit<
  DashboardData,
  'assignments' | 'mistakeSummary' | 'vocabSummary'
>

// Loading component for dashboard data
function DashboardLoading() {
  return (
    <div className="h-full bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading your dashboard...</p>
      </div>
    </div>
  )
}

// Client component to fetch dashboard data
async function getDashboardData(
  userId: string
): Promise<{ data: DashboardData; canShowResults: boolean }> {
  let canShowResults = true
  let baseMetrics: DashboardMetrics | null = null

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_student_dashboard_data',
      {
        p_user_id: userId,
      }
    )

    if (!rpcError && rpcData) {
      baseMetrics = rpcData as DashboardMetrics

      if (Array.isArray(rpcData.recentAttempts) && rpcData.recentAttempts.length > 0) {
        const mostRecentExam = rpcData.recentAttempts[0]
        if (mostRecentExam?.exam_id) {
          try {
            canShowResults = await ExamService.canShowResults(
              userId,
              mostRecentExam.exam_id
            )
          } catch (error) {
            canShowResults = true
          }
        }
      }
    }
  } catch (error) {
    console.log('RPC function not available, falling back to individual calls')
  }

  if (!baseMetrics) {
    const [
      overallStats,
      scoreHistoryData,
      recentAttempts,
      previousMonthStats,
      activityDays,
      weeklyActivity,
      subjectScores,
    ] = await Promise.all([
      AnalyticsService.getDashboardOverallStats(userId),
      AnalyticsService.getDashboardScoreHistory(userId),
      fetchRecentAttempts(userId),
      fetchPreviousMonthStats(userId),
      fetchUserActivityDays(userId),
      WeeklyActivityService.fetchWeeklyActivityData(userId),
      fetchUserSubjectScores(userId),
    ])

    if (recentAttempts.length > 0) {
      const mostRecentExam = recentAttempts[0]
      if (mostRecentExam.exam_id) {
        try {
          canShowResults = await ExamService.canShowResults(
            userId,
            mostRecentExam.exam_id
          )
        } catch (error) {
          canShowResults = true
        }
      }
    }

    baseMetrics = {
      overallStats,
      scoreHistory: scoreHistoryData,
      recentAttempts,
      previousMonthStats,
      activityDays,
      weeklyActivity,
      subjectScores,
    }
  }

  const [assignments, mistakeSummary, vocabSummary] = await Promise.all([
    fetchAssignmentTasks(userId),
    fetchMistakeSummary(userId),
    fetchVocabSummary(userId),
  ])

  const dashboardData: DashboardData = {
    ...baseMetrics,
    assignments,
    mistakeSummary,
    vocabSummary,
  }

  return { data: dashboardData, canShowResults }
}

// Helper functions moved to server-side execution
async function fetchRecentAttempts(userId: string): Promise<TestAttempt[]> {
  const userAttempts = await ExamService.getUserAttempts(userId)

  const validAttempts = userAttempts.filter(
    (attempt) =>
      attempt.status !== 'not_started' && attempt.status !== 'expired'
  )

  const sortedAttempts = validAttempts
    .sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return -1
      if (a.status !== 'completed' && b.status === 'completed') return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, 5)

  return sortedAttempts
}

async function fetchPreviousMonthStats(userId: string) {
  const now = new Date()
  const startOfPreviousMonth = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  )
  const endOfPreviousMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59
  )

  const { data, error } = await supabase
    .from('test_attempts')
    .select('total_score, final_scores')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('completed_at', startOfPreviousMonth.toISOString())
    .lte('completed_at', endOfPreviousMonth.toISOString())

  if (error) {
    return { examsTaken: 0, bestScore: null, averageScore: null }
  }

  const attempts = data || []
  const examsTaken = attempts.length

  if (examsTaken === 0) {
    return { examsTaken: 0, bestScore: null, averageScore: null }
  }

  const scores = attempts
    .map((attempt) => {
      return (attempt as { final_scores?: { overall?: number }; total_score?: number }).final_scores?.overall || attempt.total_score || 0
    })
    .filter((score) => score > 0)

  const bestScore = scores.length > 0 ? Math.max(...scores) : null
  const averageScore =
    scores.length > 0
      ? Math.round(
          scores.reduce((sum, score) => sum + score, 0) / scores.length
        )
      : null

  return { examsTaken, bestScore, averageScore }
}

async function fetchUserActivityDays(userId: string): Promise<string[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [completedTests, startedTests] = await Promise.all([
    supabase
      .from('test_attempts')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', thirtyDaysAgo.toISOString()),
    supabase
      .from('test_attempts')
      .select('started_at')
      .eq('user_id', userId)
      .gte('started_at', thirtyDaysAgo.toISOString()),
  ])

  const activityDates = new Set<string>()

  completedTests.data?.forEach((attempt) => {
    if (attempt.completed_at) {
      activityDates.add(attempt.completed_at.split('T')[0])
    }
  })

  startedTests.data?.forEach((attempt) => {
    if (attempt.started_at) {
      activityDates.add(attempt.started_at.split('T')[0])
    }
  })

  return Array.from(activityDates).sort()
}

async function fetchUserSubjectScores(
  userId: string
): Promise<{ reading: number; writing: number; math: number }> {
  const { data: attempts, error } = await supabase
    .from('test_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)

  if (error || !attempts || attempts.length === 0) {
    return { reading: 0, writing: 0, math: 0 }
  }

  const mostRecentAttempt = attempts[0]

  if (
    mostRecentAttempt.final_scores &&
    mostRecentAttempt.final_scores.english &&
    mostRecentAttempt.final_scores.math
  ) {
    const englishScore = mostRecentAttempt.final_scores.english
    const mathScore = mostRecentAttempt.final_scores.math

    return {
      reading: Math.round(englishScore / 2),
      writing: Math.round(englishScore / 2),
      math: mathScore,
    }
  }

  // Fallback calculation logic remains the same but runs on server
  const { data: answers, error: answersError } = await supabase
    .from('user_answers')
    .select(
      `
      *,
      questions:question_id (
        module_type,
        difficulty_level
      )
    `
    )
    .eq('attempt_id', mostRecentAttempt.id)

  if (answersError || !answers) {
    return { reading: 0, writing: 0, math: 0 }
  }

  const moduleStats = {
    english1: { correct: 0, total: 0 },
    english2: { correct: 0, total: 0 },
    math1: { correct: 0, total: 0 },
    math2: { correct: 0, total: 0 },
  }

  answers.forEach((answer: { questions?: { module_type?: string }; is_correct?: boolean }) => {
    const question = answer.questions
    if (question && question.module_type) {
      moduleStats[question.module_type as keyof typeof moduleStats].total++
      if (answer.is_correct) {
        moduleStats[question.module_type as keyof typeof moduleStats].correct++
      }
    }
  })

  const convertToScore = (correct: number, total: number) => {
    if (total === 0) return 0
    const percentage = correct / total
    return Math.round(200 + percentage * 600)
  }

  const readingScore = convertToScore(
    moduleStats.english1.correct,
    moduleStats.english1.total
  )
  const writingScore = convertToScore(
    moduleStats.english2.correct,
    moduleStats.english2.total
  )
  const mathScore = convertToScore(
    moduleStats.math1.correct + moduleStats.math2.correct,
    moduleStats.math1.total + moduleStats.math2.total
  )

  return {
    reading: readingScore,
    writing: writingScore,
    math: mathScore,
  }
}

async function fetchAssignmentTasks(userId: string): Promise<AssignmentTask[]> {
  const now = Date.now()
  const { data: assignmentRows, error } = await supabase
    .from('exam_assignments')
    .select(
      `
      id,
      exam_id,
      assigned_at,
      due_date,
      is_active,
      exams (
        id,
        title,
        total_questions,
        time_limits
      )
    `
    )
    .eq('student_id', userId)
    .eq('is_active', true)
    .order('assigned_at', { ascending: false })

  if (error) {
    console.error('Error fetching assignments for dashboard:', error)
    return []
  }

  const assignments = (assignmentRows || []).filter(
    (assignment: any) => assignment.exams
  )

  const examIds = Array.from(
    new Set(
      assignments
        .map((assignment: any) => assignment.exam_id)
        .filter((id: string | null): id is string => Boolean(id))
    )
  )

  const latestAttemptsByExam = new Map<
    string,
    {
      id: string
      status: string
      current_question_number: number | null
      created_at: string | null
      started_at: string | null
      updated_at: string | null
      completed_at: string | null
    }
  >()

  if (examIds.length > 0) {
    const { data: attempts, error: attemptsError } = await supabase
      .from('test_attempts')
      .select(
        `
        id,
        exam_id,
        status,
        current_question_number,
        created_at,
        started_at,
        updated_at,
        completed_at
      `
      )
      .eq('user_id', userId)
      .in('exam_id', examIds)
      .order('created_at', { ascending: false })

    if (attemptsError) {
      console.error('Error fetching attempts for assignments:', attemptsError)
    } else {
      for (const attempt of attempts || []) {
        if (!attempt.exam_id) continue
        if (!latestAttemptsByExam.has(attempt.exam_id)) {
          latestAttemptsByExam.set(attempt.exam_id, attempt)
        }
      }
    }
  }

  return assignments.map((assignment: any) => {
    const exam = assignment.exams as {
      id: string
      title: string
      total_questions: number | null
      time_limits: Record<string, number> | null
    }

    const attempt = latestAttemptsByExam.get(assignment.exam_id)

    let status: 'not_started' | 'in_progress' | 'completed' = 'not_started'
    if (attempt) {
      if (attempt.status === 'completed') {
        status = 'completed'
      } else if (attempt.status === 'in_progress') {
        status = 'in_progress'
      }
    }

    const totalQuestions = exam?.total_questions ?? null
    const currentQuestionNumber = attempt?.current_question_number || 1
    let progressPercent = 0
    if (status === 'completed') {
      progressPercent = 100
    } else if (
      status === 'in_progress' &&
      totalQuestions &&
      totalQuestions > 0
    ) {
      progressPercent = Math.max(
        5,
        Math.min(
          95,
          Math.round(((currentQuestionNumber - 1) / totalQuestions) * 100)
        )
      )
    }

    const lastActivityAt =
      attempt?.updated_at ||
      attempt?.completed_at ||
      attempt?.started_at ||
      assignment.assigned_at ||
      null

    const dueDate = assignment.due_date as string | null
    const dueTime = dueDate ? new Date(dueDate).getTime() : null
    const isOverdue =
      typeof dueTime === 'number' &&
      status !== 'completed' &&
      dueTime < now
    const isDueSoon =
      typeof dueTime === 'number' &&
      status !== 'completed' &&
      !isOverdue &&
      dueTime - now <= 1000 * 60 * 60 * 48

    const timeLimits = exam?.time_limits || null
    const estimatedMinutes = timeLimits
      ? Object.values(timeLimits).reduce(
          (total, value) => total + (value || 0),
          0
        )
      : null

    return {
      assignmentId: assignment.id as string,
      examId: exam.id,
      examTitle: exam.title,
      status,
      assignedAt: assignment.assigned_at as string | null,
      dueDate,
      lastActivityAt,
      isOverdue,
      isDueSoon,
      progressPercent,
      totalQuestions,
      estimatedMinutes,
    }
  })
}

async function fetchMistakeSummary(userId: string): Promise<MistakeSummary> {
  const { data: mistakeRows, error } = await supabase
    .from('mistake_bank')
    .select(
      `
      id,
      status,
      question_id,
      first_mistaken_at,
      last_reviewed_at
    `
    )
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching mistake summary:', error)
    return {
      total: 0,
      unmastered: 0,
      mastered: 0,
      lastReviewedAt: null,
      countsByExam: [],
      countsByModule: [],
    }
  }

  const mistakes = mistakeRows || []

  if (mistakes.length === 0) {
    return {
      total: 0,
      unmastered: 0,
      mastered: 0,
      lastReviewedAt: null,
      countsByExam: [],
      countsByModule: [],
    }
  }

  const questionIds = Array.from(
    new Set(
      mistakes
        .map((mistake: any) => mistake.question_id)
        .filter((id: string | null): id is string => Boolean(id))
    )
  )

  const questionMap = new Map<
    string,
    { id: string; exam_id: string | null; module_type: string | null }
  >()

  if (questionIds.length > 0) {
    const { data: questionRows, error: questionsError } = await supabase
      .from('questions')
      .select('id, exam_id, module_type')
      .in('id', questionIds)

    if (questionsError) {
      console.error(
        'Error fetching questions for mistake summary:',
        questionsError
      )
    } else {
      for (const question of questionRows || []) {
        questionMap.set(question.id, question)
      }
    }
  }

  const examIds = Array.from(
    new Set(
      Array.from(questionMap.values())
        .map((question) => question.exam_id)
        .filter((id): id is string => Boolean(id))
    )
  )

  const examMap = new Map<string, { id: string; title: string }>()

  if (examIds.length > 0) {
    const { data: examRows, error: examsError } = await supabase
      .from('exams')
      .select('id, title')
      .in('id', examIds)

    if (examsError) {
      console.error('Error fetching exams for mistake summary:', examsError)
    } else {
      for (const exam of examRows || []) {
        examMap.set(exam.id, exam)
      }
    }
  }

  let lastReviewedAt: string | null = null
  const moduleCounts = new Map<string, number>()
  const examCounts = new Map<
    string,
    { examId: string | null; examTitle: string; count: number }
  >()
  let unmastered = 0

  mistakes.forEach((mistake: any) => {
    if (mistake.status === 'unmastered') {
      unmastered += 1
    }

    if (mistake.last_reviewed_at) {
      if (
        !lastReviewedAt ||
        new Date(mistake.last_reviewed_at) > new Date(lastReviewedAt)
      ) {
        lastReviewedAt = mistake.last_reviewed_at
      }
    }

    const question = questionMap.get(mistake.question_id)
    if (question?.module_type) {
      moduleCounts.set(
        question.module_type,
        (moduleCounts.get(question.module_type) || 0) + 1
      )
    }

    if (question?.exam_id) {
      const exam = examMap.get(question.exam_id)
      const title = exam?.title || 'Unlabeled Exam'
      if (examCounts.has(question.exam_id)) {
        const existing = examCounts.get(question.exam_id)!
        existing.count += 1
      } else {
        examCounts.set(question.exam_id, {
          examId: question.exam_id,
          examTitle: title,
          count: 1,
        })
      }
    } else {
      if (examCounts.has('unlinked')) {
        const existing = examCounts.get('unlinked')!
        existing.count += 1
      } else {
        examCounts.set('unlinked', {
          examId: null,
          examTitle: 'Unlinked Questions',
          count: 1,
        })
      }
    }
  })

  const mastered = mistakes.length - unmastered

  return {
    total: mistakes.length,
    unmastered,
    mastered,
    lastReviewedAt,
    countsByExam: Array.from(examCounts.values()).sort(
      (a, b) => b.count - a.count
    ),
    countsByModule: Array.from(moduleCounts.entries())
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count),
  }
}

async function fetchVocabSummary(userId: string): Promise<VocabSummary> {
  try {
    const [dueCount, reviewSets] = await Promise.all([
      getTodayReviewCount(userId),
      getVocabSetsWithReviewsDue(userId),
    ])

    const [{ count: totalWords }, { data: nextReview }] = await Promise.all([
      supabase
        .from('vocab_entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('user_vocab_progress')
        .select('next_review_date')
        .eq('user_id', userId)
        .gt('next_review_date', new Date().toISOString())
        .order('next_review_date', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    return {
      dueToday: dueCount,
      totalWords: totalWords || 0,
      nextReviewAt: nextReview?.next_review_date ?? null,
      reviewSets,
    }
  } catch (error) {
    console.error('Error fetching vocab summary:', error)
    return {
      dueToday: 0,
      totalWords: 0,
      nextReviewAt: null,
      reviewSets: [],
    }
  }
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [canShowResults, setCanShowResults] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.id) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const { data, canShowResults: canShow } = await getDashboardData(user.id)
      setDashboardData(data)
      setCanShowResults(canShow)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading || !user) {
    return <DashboardLoading />
  }

  if (error) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error loading dashboard: {error}</p>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return <DashboardLoading />
  }

  return (
    <DashboardClient
      initialData={dashboardData}
      canShowResults={canShowResults}
    />
  )
}
