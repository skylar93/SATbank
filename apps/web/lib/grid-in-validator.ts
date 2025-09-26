/**
 * Grid-In Answer Validation Utility
 * Handles multiple correct answers with mathematical equivalence checking
 */

export interface GridInValidationResult {
  isCorrect: boolean
  matchedAnswer?: string
  normalizedUserAnswer?: string
}

/**
 * Normalizes a numeric answer for comparison
 */
function normalizeAnswer(answer: string): string {
  const trimmed = answer.trim()

  // Handle fractions
  if (trimmed.includes('/')) {
    const [numerator, denominator] = trimmed
      .split('/')
      .map((s) => parseFloat(s.trim()))
    if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
      return (numerator / denominator).toString()
    }
  }

  // Handle decimals and integers
  const numValue = parseFloat(trimmed)
  if (!isNaN(numValue)) {
    return numValue.toString()
  }

  // Return original if not numeric
  return trimmed.toLowerCase()
}

/**
 * Checks if two answers are mathematically equivalent
 */
function answersAreEquivalent(answer1: string, answer2: string): boolean {
  const norm1 = normalizeAnswer(answer1)
  const norm2 = normalizeAnswer(answer2)

  // Try numeric comparison first
  const num1 = parseFloat(norm1)
  const num2 = parseFloat(norm2)

  if (!isNaN(num1) && !isNaN(num2)) {
    // Use a small tolerance for floating point comparison
    return Math.abs(num1 - num2) < 0.0001
  }

  // Fall back to string comparison for non-numeric answers
  return norm1 === norm2
}

/**
 * Safely parses correct_answers from various formats
 */
export function parseCorrectAnswers(question: {
  correct_answers?: any
  correct_answer?: string
}): string[] {
  let answers: any = question.correct_answers

  // Handle null/undefined
  if (!answers) {
    return question.correct_answer ? [question.correct_answer] : []
  }

  // Already an array
  if (Array.isArray(answers)) {
    const result: string[] = []

    for (const answer of answers) {
      if (typeof answer === 'string') {
        // Check if it looks like JSON
        if (answer.trim().startsWith('[') || answer.trim().startsWith('"')) {
          try {
            const parsed = JSON.parse(answer)
            if (Array.isArray(parsed)) {
              result.push(...parsed.map(String))
            } else {
              result.push(String(parsed))
            }
          } catch {
            result.push(answer)
          }
        } else {
          result.push(answer)
        }
      } else {
        result.push(String(answer))
      }
    }

    return result.filter((a) => a.trim().length > 0)
  }

  // String that might be JSON
  if (typeof answers === 'string') {
    try {
      const parsed = JSON.parse(answers)
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter((a) => a.trim().length > 0)
      } else {
        return [String(parsed)]
      }
    } catch {
      return [answers]
    }
  }

  // Fallback
  return [String(answers)]
}

/**
 * Validates a user's grid-in answer against possible correct answers
 */
export function validateGridInAnswer(
  question: {
    correct_answers?: any
    correct_answer?: string
  },
  userAnswer: string
): GridInValidationResult {
  if (!userAnswer?.trim()) {
    return { isCorrect: false }
  }

  const correctAnswers = parseCorrectAnswers(question)
  const normalizedUserAnswer = normalizeAnswer(userAnswer)

  // Check each possible correct answer
  for (const correctAnswer of correctAnswers) {
    if (answersAreEquivalent(userAnswer, correctAnswer)) {
      return {
        isCorrect: true,
        matchedAnswer: correctAnswer,
        normalizedUserAnswer,
      }
    }
  }

  return {
    isCorrect: false,
    normalizedUserAnswer,
  }
}

/**
 * Formats correct answers for display
 */
export function formatCorrectAnswersDisplay(correctAnswers: string[]): string {
  if (correctAnswers.length === 0) return ''
  if (correctAnswers.length === 1) return correctAnswers[0]

  // Group equivalent answers together
  const groups: string[][] = []

  for (const answer of correctAnswers) {
    let addedToGroup = false

    for (const group of groups) {
      if (answersAreEquivalent(answer, group[0])) {
        group.push(answer)
        addedToGroup = true
        break
      }
    }

    if (!addedToGroup) {
      groups.push([answer])
    }
  }

  // Format each group
  const formattedGroups = groups.map((group) => {
    if (group.length === 1) return group[0]
    return group.join(' or ')
  })

  return formattedGroups.join(', ')
}
