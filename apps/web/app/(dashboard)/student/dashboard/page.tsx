'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../../../contexts/auth-context'
import DashboardClient from '../../../../components/dashboard/DashboardClient'
import { ExamService, type TestAttempt } from '../../../../lib/exam-service'
import { AnalyticsService } from '../../../../lib/analytics-service'
import { WeeklyActivityService } from '../../../../lib/weekly-activity-service'
import { supabase } from '../../../../lib/supabase'

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
}

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
  try {
    // Try using the new RPC function first
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_student_dashboard_data',
      {
        p_user_id: userId,
      }
    )

    if (!rpcError && rpcData) {
      // Check if user can see results for completed exams
      let canShowResults = true
      if (rpcData.recentAttempts.length > 0) {
        const mostRecentExam = rpcData.recentAttempts[0]
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

      return { data: rpcData, canShowResults }
    }
  } catch (error) {
    console.log('RPC function not available, falling back to individual calls')
  }

  // Fallback: Use individual API calls (original approach)
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

  // Check if user can see results for completed exams
  let canShowResults = true
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

  const dashboardData: DashboardData = {
    overallStats,
    scoreHistory: scoreHistoryData,
    recentAttempts,
    previousMonthStats,
    activityDays,
    weeklyActivity,
    subjectScores,
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
