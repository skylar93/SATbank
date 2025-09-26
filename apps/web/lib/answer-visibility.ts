/**
 * Shared utility functions for answer visibility logic
 * Used by both server and client components to determine if answers should be shown
 */

export interface TestAttemptWithVisibility {
  id: string
  answers_visible: boolean
  answers_visible_after: string | null
  review_attempt_taken?: boolean
  [key: string]: any
}

/**
 * Determines if answers should be visible for a given test attempt
 * @param attempt - The test attempt object with visibility fields
 * @returns boolean - Whether answers should be shown
 */
export function canShowAnswers(attempt: TestAttemptWithVisibility): boolean {
  const now = new Date()

  // If second chance review was completed, always show answers
  if (attempt.review_attempt_taken) {
    return true
  }

  // If answers are explicitly set to visible
  if (attempt.answers_visible) {
    return true
  }

  // Check if there's a scheduled release time and if it has passed
  if (attempt.answers_visible_after) {
    const releaseDate = new Date(attempt.answers_visible_after)
    return now >= releaseDate
  }

  // Default to hidden if no visibility settings
  return false
}

/**
 * Gets a human-readable status of answer visibility
 * @param attempt - The test attempt object with visibility fields
 * @returns object with status and color information
 */
export function getAnswerVisibilityStatus(attempt: TestAttemptWithVisibility): {
  status: string
  color: string
  canShow: boolean
} {
  const canShow = canShowAnswers(attempt)

  if (attempt.answers_visible) {
    return { status: 'Visible', color: 'text-emerald-600', canShow: true }
  } else if (attempt.answers_visible_after) {
    const releaseDate = new Date(attempt.answers_visible_after)
    const now = new Date()

    if (now >= releaseDate) {
      return { status: 'Visible', color: 'text-emerald-600', canShow: true }
    } else {
      return {
        status: `Available ${releaseDate.toLocaleDateString()}`,
        color: 'text-orange-600',
        canShow: false,
      }
    }
  }

  return { status: 'Hidden', color: 'text-gray-600', canShow: false }
}
