import { type TestAttempt } from './exam-service'

/**
 * Helper function to get the display score (prefer final_scores.overall, fallback to total_score)
 */
export function getDisplayScore(attempt: TestAttempt): number {
  return attempt.final_scores?.overall || attempt.total_score || 0
}

/**
 * Calculate percentage change between two numbers
 * @param current - Current value
 * @param previous - Previous value to compare against
 * @returns Object with formatted change string and zero flag
 */
export function calculatePercentageChange(
  current: number | null,
  previous: number | null
): { change: string; isZero: boolean } {
  if (!current || !previous || previous === 0) {
    return { change: '0%', isZero: true }
  }
  const change = ((current - previous) / previous) * 100
  const prefix = change >= 0 ? '+' : ''
  return { change: `${prefix}${change.toFixed(1)}%`, isZero: false }
}

/**
 * Format date string for display in exam results
 */
export function formatExamDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Get appropriate status color class for exam attempts
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800'
    case 'expired':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Calculate total score from module scores object
 */
export function calculateTotalScore(moduleScores: any): number {
  if (!moduleScores) return 0
  return Object.values(moduleScores).reduce(
    (sum: number, score: any) => sum + (score || 0),
    0
  )
}

/**
 * Check if results can be shown for a specific attempt based on visibility rules
 */
export function canShowAttemptResults(
  attempt: TestAttempt,
  resultVisibility: Map<string, boolean>
): boolean {
  if (!attempt.exam_id) return true // Practice mode, always show
  return resultVisibility.get(attempt.exam_id) ?? true
}