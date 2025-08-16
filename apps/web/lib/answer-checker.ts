/**
 * Utility functions for checking answers with support for multiple correct answers
 */

export function checkAnswer(
  userAnswer: string,
  correctAnswers: string | string[]
): boolean {
  if (!userAnswer) return false

  // Handle single correct answer (backward compatibility)
  if (typeof correctAnswers === 'string') {
    return (
      userAnswer.toLowerCase().trim() === correctAnswers.toLowerCase().trim()
    )
  }

  // Handle multiple correct answers
  if (Array.isArray(correctAnswers)) {
    return correctAnswers.some(
      (correct) =>
        userAnswer.toLowerCase().trim() === correct.toLowerCase().trim()
    )
  }

  return false
}

/**
 * Normalize correct_answer field from database to string array
 */
export function normalizeCorrectAnswers(correctAnswer: any): string[] {
  if (typeof correctAnswer === 'string') {
    return [correctAnswer]
  }

  if (Array.isArray(correctAnswer)) {
    return correctAnswer.filter((answer) => typeof answer === 'string')
  }

  // Handle JSON string case
  if (typeof correctAnswer === 'object' && correctAnswer !== null) {
    try {
      const parsed = Array.isArray(correctAnswer)
        ? correctAnswer
        : JSON.parse(JSON.stringify(correctAnswer))
      return Array.isArray(parsed)
        ? parsed.filter((answer) => typeof answer === 'string')
        : []
    } catch {
      return []
    }
  }

  return []
}

/**
 * Check if a question has multiple correct answers
 */
export function hasMultipleCorrectAnswers(correctAnswer: any): boolean {
  const normalized = normalizeCorrectAnswers(correctAnswer)
  return normalized.length > 1
}
