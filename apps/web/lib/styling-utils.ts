// apps/web/lib/styling-utils.ts

export function getScoreColorClassName(score: number | null): string {
  if (score === null || score === undefined) return 'text-gray-500'
  if (score >= 1400) return 'text-emerald-600 font-bold'
  if (score >= 1200) return 'text-blue-600 font-semibold'
  if (score < 1000) return 'text-red-600'
  return 'text-gray-800'
}

export function getDurationWarning(seconds: number | null): boolean {
  if (seconds === null || seconds === undefined) return false
  // Returns true if duration is less than 1 minute or more than 4 hours
  return seconds < 60 || seconds > 4 * 60 * 60
}
