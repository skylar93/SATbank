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
    // Try to parse if it looks like JSON
    try {
      const parsed = JSON.parse(correctAnswer)
      if (Array.isArray(parsed)) {
        return parsed.filter((answer) => typeof answer === 'string')
      }
    } catch {
      // If parsing fails, treat as single string answer
      return [correctAnswer]
    }
    return [correctAnswer]
  }

  if (Array.isArray(correctAnswer)) {
    // Handle double-encoded JSON arrays like ["[\"8\"]"]
    const result: string[] = []
    for (const item of correctAnswer) {
      if (typeof item === 'string') {
        // Try to parse if it looks like JSON
        try {
          const parsed = JSON.parse(item)
          if (Array.isArray(parsed)) {
            result.push(
              ...parsed.filter((answer) => typeof answer === 'string')
            )
          } else if (typeof parsed === 'string') {
            result.push(parsed)
          } else {
            result.push(item)
          }
        } catch {
          // If parsing fails, treat as regular string
          result.push(item)
        }
      }
    }
    return result
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
