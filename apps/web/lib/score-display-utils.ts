/**
 * Utility functions for displaying scores based on exam template type
 * Handles filtering scores for English-only and Math-only exams
 */

interface FinalScores {
  overall?: number
  english?: number
  math?: number
}

interface ExamTemplate {
  id: string
  scoring_groups: {
    english?: string[]
    math?: string[]
  }
}

export interface DisplayScores {
  overall: number
  english?: number
  math?: number
  maxTotal: number
  sections: {
    showEnglish: boolean
    showMath: boolean
  }
}

/**
 * Gets display scores based on exam template type
 * Filters out sections that weren't part of the exam
 */
export function getDisplayScores(
  finalScores: FinalScores | null | undefined,
  templateId: string | null | undefined
): DisplayScores {
  if (!finalScores) {
    return {
      overall: 0,
      maxTotal: 1600,
      sections: { showEnglish: false, showMath: false },
    }
  }

  let showEnglish = templateId === 'english_only' || templateId === 'full_sat'
  let showMath = templateId === 'math_only' || templateId === 'full_sat'

  // If template type is unknown, infer from available scores
  if (!showEnglish && !showMath) {
    showEnglish = typeof finalScores.english === 'number'
    showMath = typeof finalScores.math === 'number'
  }

  // Calculate max total based on sections included
  let maxTotal = 1600 // default for full SAT
  if (showEnglish && !showMath) maxTotal = 800
  if (showMath && !showEnglish) maxTotal = 800

  return {
    overall: finalScores.overall || 0,
    ...(showEnglish && { english: finalScores.english || 0 }),
    ...(showMath && { math: finalScores.math || 0 }),
    maxTotal,
    sections: { showEnglish, showMath },
  }
}

/**
 * Gets the score string with appropriate max score
 * e.g., "650/800" for English-only or "1450/1600" for full SAT
 */
export function getScoreString(
  score: number,
  templateId: string | null | undefined
): string {
  const maxScore =
    templateId === 'english_only' || templateId === 'math_only' ? 800 : 1600
  return `${score}/${maxScore}`
}
