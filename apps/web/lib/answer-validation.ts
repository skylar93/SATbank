export interface AnswerValidationResult {
  isCorrect: boolean
  normalizedAnswer: string
  originalAnswer: string
}

export function validateAnswer(
  userAnswer: string,
  correctAnswer: string
): AnswerValidationResult {
  const normalizedUserAnswer = normalizeAnswer(userAnswer)
  const normalizedCorrectAnswer = normalizeAnswer(correctAnswer)

  const userEquivalents = generateEquivalentAnswers(normalizedUserAnswer)
  const correctEquivalents = generateEquivalentAnswers(normalizedCorrectAnswer)

  const isCorrect = userEquivalents.some((userEq) =>
    correctEquivalents.some((correctEq) => areEquivalent(userEq, correctEq))
  )

  return {
    isCorrect,
    normalizedAnswer: normalizedUserAnswer,
    originalAnswer: userAnswer,
  }
}

function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, '')
}

function generateEquivalentAnswers(answer: string): string[] {
  const equivalents = new Set([answer])

  if (isFraction(answer)) {
    const decimal = fractionToDecimal(answer)
    if (decimal !== null) {
      equivalents.add(decimal.toString())
      equivalents.add(decimal.toFixed(2))
      equivalents.add(Math.round(decimal * 100) / 100 + '')
      equivalents.add(Math.round(decimal * 1000) / 1000 + '')
    }
  } else if (isDecimal(answer)) {
    const decimal = parseFloat(answer)
    const fraction = decimalToFraction(decimal)
    if (fraction) {
      equivalents.add(fraction)
    }

    const rounded2 = Math.round(decimal * 100) / 100
    const rounded3 = Math.round(decimal * 1000) / 1000
    equivalents.add(rounded2.toString())
    equivalents.add(rounded2.toFixed(2))
    equivalents.add(rounded3.toString())
  }

  return Array.from(equivalents)
}

function isFraction(str: string): boolean {
  return /^-?\d+\/\d+$/.test(str)
}

function isDecimal(str: string): boolean {
  return /^-?\d+\.?\d*$/.test(str) && !isNaN(parseFloat(str))
}

function fractionToDecimal(fraction: string): number | null {
  const match = fraction.match(/^(-?\d+)\/(\d+)$/)
  if (!match) return null

  const numerator = parseInt(match[1])
  const denominator = parseInt(match[2])

  if (denominator === 0) return null

  return numerator / denominator
}

function decimalToFraction(decimal: number): string | null {
  if (!isFinite(decimal)) return null

  const tolerance = 1e-6
  let numerator = Math.round(decimal)
  let denominator = 1

  if (Math.abs(decimal - numerator) > tolerance) {
    const decimalStr = decimal.toString()
    const decimalPlaces = decimalStr.includes('.')
      ? decimalStr.split('.')[1].length
      : 0

    denominator = Math.pow(10, decimalPlaces)
    numerator = Math.round(decimal * denominator)

    const gcd = findGCD(Math.abs(numerator), denominator)
    numerator /= gcd
    denominator /= gcd
  }

  if (denominator === 1) {
    return null
  }

  return `${numerator}/${denominator}`
}

function findGCD(a: number, b: number): number {
  while (b !== 0) {
    const temp = b
    b = a % b
    a = temp
  }
  return a
}

function areEquivalent(answer1: string, answer2: string): boolean {
  if (answer1 === answer2) return true

  if (isFraction(answer1) && isFraction(answer2)) {
    return false
  }

  const num1 = parseFloat(answer1)
  const num2 = parseFloat(answer2)

  if (isNaN(num1) || isNaN(num2)) return false

  return Math.abs(num1 - num2) < 0.005
}
