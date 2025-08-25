import { ExamService, type TestAttempt, type Exam } from './exam-service'

export interface ResultsDashboardData {
  attempts: (TestAttempt & { exam?: Exam })[]
  resultVisibility: Map<string, boolean>
}

export interface DashboardStats {
  totalAttempts: number
  completedAttempts: TestAttempt[]
  visibleCompletedAttempts: TestAttempt[]
  averageScore: number
  bestScore: number
  previousPeriodStats: {
    totalExams: number
    bestScore: number
    averageScore: number
  }
  progressData: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      borderColor: string
      backgroundColor: string
      fill: boolean
    }>
  }
}

/**
 * Efficiently fetches all results dashboard data in minimal queries
 * Solves N+1 query problem by fetching attempts and visibility in optimized way
 */
export async function getResultsDashboardData(userId: string): Promise<ResultsDashboardData> {
  if (!userId) {
    throw new Error('User ID is required')
  }

  // Fetch user attempts first
  const userAttempts = await ExamService.getUserAttempts(userId)

  // Filter out not_started and expired attempts
  const validAttempts = userAttempts.filter(
    (attempt) =>
      attempt.status !== 'not_started' && attempt.status !== 'expired'
  )

  // Group attempts by exam_id and keep only the most recent in_progress attempt per exam
  const attemptsByExam = new Map<string, TestAttempt[]>()

  validAttempts.forEach((attempt) => {
    if (!attemptsByExam.has(attempt.exam_id)) {
      attemptsByExam.set(attempt.exam_id, [])
    }
    attemptsByExam.get(attempt.exam_id)!.push(attempt)
  })

  const consolidatedAttempts: (TestAttempt & { exam?: Exam })[] = []

  attemptsByExam.forEach((attempts, examId) => {
    // Separate completed and in_progress attempts
    const completedAttempts = attempts.filter(
      (a) => a.status === 'completed'
    )
    const inProgressAttempts = attempts.filter(
      (a) => a.status === 'in_progress'
    )

    // Add all completed attempts
    consolidatedAttempts.push(...completedAttempts)

    // Add only the most recent in_progress attempt if any
    if (inProgressAttempts.length > 0) {
      const mostRecentInProgress = inProgressAttempts.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime()
      )[0]
      consolidatedAttempts.push(mostRecentInProgress)
    }
  })

  // Sort by created_at descending
  const sortedAttempts = consolidatedAttempts.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Check result visibility for all unique exams in parallel
  const resultVisibility = await checkResultVisibilityBatch(userId, sortedAttempts)

  return {
    attempts: sortedAttempts,
    resultVisibility,
  }
}

/**
 * Efficiently checks result visibility for multiple attempts in batch
 * Reduces database calls by checking unique exam IDs only once
 */
async function checkResultVisibilityBatch(
  userId: string, 
  attempts: (TestAttempt & { exam?: Exam })[]
): Promise<Map<string, boolean>> {
  const visibilityMap = new Map<string, boolean>()

  // Get unique exam IDs
  const uniqueExamIds = [
    ...new Set(attempts.filter((a) => a.exam_id).map((a) => a.exam_id!)),
  ]

  if (uniqueExamIds.length === 0) {
    return visibilityMap
  }

  // Check visibility for all exams in parallel
  await Promise.all(
    uniqueExamIds.map(async (examId) => {
      try {
        const canShow = await ExamService.canShowResults(userId, examId)
        visibilityMap.set(examId, canShow)
      } catch (error) {
        // Default to true for practice mode or if there's an error
        visibilityMap.set(examId, true)
      }
    })
  )

  return visibilityMap
}

/**
 * Processes dashboard data and calculates all statistics
 * Separated from data fetching for better testability and reusability
 */
export function calculateDashboardStats(
  attempts: (TestAttempt & { exam?: Exam })[],
  resultVisibility: Map<string, boolean>
): DashboardStats {
  const completedAttempts = attempts.filter((a) => a.status === 'completed')
  
  // Helper function to check if results can be shown for an attempt
  const canShowAttemptResults = (attempt: TestAttempt): boolean => {
    if (!attempt.exam_id) return true // Practice mode, always show
    return resultVisibility.get(attempt.exam_id) ?? true
  }

  // Filter completed attempts that can show results for stats calculation
  const visibleCompletedAttempts = completedAttempts.filter(
    canShowAttemptResults
  )

  // Helper function to get the display score (prefer final_scores.overall, fallback to total_score)
  const getDisplayScore = (attempt: TestAttempt): number => {
    return attempt.final_scores?.overall || attempt.total_score || 0
  }

  const averageScore =
    visibleCompletedAttempts.length > 0
      ? Math.round(
          visibleCompletedAttempts.reduce(
            (sum, a) => sum + getDisplayScore(a),
            0
          ) / visibleCompletedAttempts.length
        )
      : 0

  const bestScore =
    visibleCompletedAttempts.length > 0
      ? Math.max(...visibleCompletedAttempts.map((a) => getDisplayScore(a)))
      : 0

  // Calculate previous period stats for comparison (30 days ago)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const previousPeriodAttempts = visibleCompletedAttempts.filter(
    (a) => a.completed_at && new Date(a.completed_at) < thirtyDaysAgo
  )

  const previousTotalExams = previousPeriodAttempts.length
  const previousBestScore =
    previousPeriodAttempts.length > 0
      ? Math.max(...previousPeriodAttempts.map((a) => getDisplayScore(a)))
      : 0
  const previousAverageScore =
    previousPeriodAttempts.length > 0
      ? Math.round(
          previousPeriodAttempts.reduce(
            (sum, a) => sum + getDisplayScore(a),
            0
          ) / previousPeriodAttempts.length
        )
      : 0

  // Progress data based on actual test attempts
  const recentAttempts = visibleCompletedAttempts.slice(-5)
  const progressData = {
    labels: recentAttempts.map((attempt, index) => {
      if (attempt.completed_at) {
        const date = new Date(attempt.completed_at)
        return `${date.getMonth() + 1}/${date.getDate()}`
      }
      return `Test ${index + 1}`
    }),
    datasets: [
      {
        label: 'Total Score',
        data: recentAttempts.map((a) => getDisplayScore(a)),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
      },
    ],
  }

  return {
    totalAttempts: attempts.length,
    completedAttempts,
    visibleCompletedAttempts,
    averageScore,
    bestScore,
    previousPeriodStats: {
      totalExams: previousTotalExams,
      bestScore: previousBestScore,
      averageScore: previousAverageScore,
    },
    progressData,
  }
}