import { supabase } from './supabase'
import { createClient } from '@supabase/supabase-js'

export interface ScoringCurve {
  id: number
  name: string
  curve_data: {
    raw: number
    lower: number
    upper: number
  }[]
}

export interface FinalScores {
  overall: number
  english?: number
  math?: number
  [key: string]: number | undefined
}

export class ScoringService {
  /**
   * Validate curve data structure and values
   * @param curveData - Array of curve data points
   * @returns boolean - true if valid
   */
  private static validateCurveData(curveData: any[]): boolean {
    if (!Array.isArray(curveData) || curveData.length === 0) {
      throw new Error('Invalid curve data: must be non-empty array')
    }

    for (const point of curveData) {
      if (
        typeof point.raw !== 'number' ||
        typeof point.lower !== 'number' ||
        typeof point.upper !== 'number'
      ) {
        throw new Error(`Invalid curve point: ${JSON.stringify(point)}`)
      }

      if (point.lower > point.upper) {
        throw new Error(
          `Invalid curve range: lower (${point.lower}) > upper (${point.upper})`
        )
      }
    }

    return true
  }

  /**
   * Validate answer data structure
   * @param answer - Answer object to validate
   * @returns boolean - true if valid
   */
  private static validateAnswer(answer: any): boolean {
    return (
      answer &&
      answer.questions &&
      typeof answer.questions.module_type === 'string' &&
      answer.questions.module_type.trim() !== ''
    )
  }
  /**
   * Calculate final scaled scores for a completed exam attempt using template-aware dynamic scoring
   * @param attemptId - UUID of the test attempt
   * @param useServiceRole - Whether to use service role client (default: false)
   * @returns Promise<FinalScores> - The calculated scaled scores
   */
  static async calculateFinalScores(
    attemptId: string,
    useServiceRole: boolean = false
  ): Promise<FinalScores> {
    // Use service role client if requested (for admin operations)
    const client = useServiceRole
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        )
      : supabase

    // Step 1: Fetch essential data in parallel
    const [attemptResult, answersResult] = await Promise.all([
      client
        .from('test_attempts')
        .select('exam_id, user_id')
        .eq('id', attemptId)
        .maybeSingle(),
      client
        .from('user_answers')
        .select(
          `
          id,
          user_answer,
          is_correct,
          time_spent_seconds,
          questions:question_id!inner (
            module_type,
            points
          )
        `
        )
        .eq('attempt_id', attemptId),
    ])

    if (attemptResult.error) {
      throw new Error(
        `Failed to get attempt data: ${attemptResult.error.message}`
      )
    }
    if (!attemptResult.data) {
      throw new Error(`Test attempt ${attemptId} not found`)
    }
    if (answersResult.error) {
      throw new Error(
        `Failed to get user answers: ${answersResult.error.message}`
      )
    }

    const attemptData = attemptResult.data
    const answers = answersResult.data || []

    // Step 2: Get the parent exam and its template
    const { data: examData, error: examError } = await client
      .from('exams')
      .select(
        `
        id,
        template_id,
        english_scoring_curve_id,
        math_scoring_curve_id
      `
      )
      .eq('id', attemptData.exam_id)
      .maybeSingle()

    if (examError) {
      throw new Error(`Failed to get exam data: ${examError.message}`)
    }
    if (!examData) {
      throw new Error(`Exam ${attemptData.exam_id} not found`)
    }
    if (!examData.template_id) {
      throw new Error(
        `Exam ${attemptData.exam_id} does not have a template assigned`
      )
    }

    // Step 3: Fetch the "Blueprint" (Exam Template)
    const { data: templateData, error: templateError } = await client
      .from('exam_templates')
      .select('id, name, scoring_groups')
      .eq('id', examData.template_id)
      .maybeSingle()

    if (templateError) {
      throw new Error(`Failed to get exam template: ${templateError.message}`)
    }
    if (!templateData) {
      throw new Error(`Exam template ${examData.template_id} not found`)
    }

    const scoringGroups = templateData.scoring_groups as {
      [key: string]: string[]
    }
    console.log('📋 Template info:', {
      id: templateData.id,
      name: templateData.name,
      scoringGroups,
    })

    // Validate that all answers have question data
    const invalidAnswers = answers.filter((a) => !this.validateAnswer(a))
    if (invalidAnswers.length > 0) {
      console.warn(
        `${invalidAnswers.length} answers have invalid question data:`,
        invalidAnswers
      )
      throw new Error(
        `${invalidAnswers.length} answers missing valid question data - possible database integrity issue`
      )
    }

    // Step 4: Calculate Raw Scores by Group
    const rawScoresByGroup: { [key: string]: number } = {}

    // Initialize raw scores for each group
    Object.keys(scoringGroups).forEach((group) => {
      rawScoresByGroup[group] = 0
    })

    // Calculate raw scores
    answers.forEach((answer: any) => {
      if (!this.validateAnswer(answer)) {
        console.warn('Invalid answer data, skipping:', answer)
        return
      }

      if (answer.is_correct) {
        const moduleType = answer.questions.module_type.toLowerCase().trim()
        const points = Math.max(0, Number(answer.questions.points) || 1)

        // Find which group this module_type belongs to
        let groupFound = false
        for (const [groupName, moduleTypes] of Object.entries(scoringGroups)) {
          if (moduleTypes.includes(moduleType)) {
            rawScoresByGroup[groupName] += points
            groupFound = true
            break
          }
        }

        if (!groupFound) {
          console.warn(
            `Module type '${moduleType}' not found in any scoring group. Available groups:`,
            scoringGroups
          )
        }
      }
    })

    console.log('📊 Raw scores by group:', rawScoresByGroup)

    // Step 5: Apply Scoring Curves Dynamically
    const finalScores: FinalScores = { overall: 0 }
    const curves: { [key: string]: any } = {}

    // Fetch required scoring curves
    const curvePromises: Promise<any>[] = []

    for (const groupName of Object.keys(scoringGroups)) {
      let curveId: number | null = null

      if (groupName === 'english' && examData.english_scoring_curve_id) {
        curveId = examData.english_scoring_curve_id
      } else if (groupName === 'math' && examData.math_scoring_curve_id) {
        curveId = examData.math_scoring_curve_id
      }

      if (curveId) {
        curvePromises.push(
          Promise.resolve(
            client
              .from('scoring_curves')
              .select('id, curve_name, curve_data')
              .eq('id', curveId)
              .maybeSingle()
              .then((result) => ({ groupName, result }))
          )
        )
      } else {
        console.warn(`No scoring curve found for group '${groupName}'`)
      }
    }

    // Wait for all curves to be fetched
    const curveResults = await Promise.all(curvePromises)

    for (const { groupName, result } of curveResults) {
      if (result.error) {
        throw new Error(
          `Failed to get ${groupName} scoring curve: ${result.error.message}`
        )
      }
      if (!result.data) {
        console.warn(`${groupName} scoring curve not found, skipping group`)
        continue
      }

      curves[groupName] = result.data
    }

    // Step 6: Calculate scaled scores for each group
    for (const [groupName, rawScore] of Object.entries(rawScoresByGroup)) {
      const curve = curves[groupName]

      if (!curve) {
        console.warn(`No curve available for group '${groupName}', skipping`)
        continue
      }

      console.log(`📋 ${groupName} curve info:`, {
        id: curve.id,
        name: curve.curve_name,
      })

      // Validate curve data and map raw score to scaled score
      this.validateCurveData(curve.curve_data)
      const scaledScore = this.mapRawToScaled(rawScore, curve.curve_data)

      finalScores[groupName] = scaledScore
      console.log(
        `⚖️ ${groupName}: raw ${rawScore} → scaled ${scaledScore} (using curve: ${curve.curve_name})`
      )
    }

    // Step 7: Calculate Final Overall Score
    let overallScore = 0
    for (const [key, value] of Object.entries(finalScores)) {
      if (key !== 'overall' && typeof value === 'number') {
        overallScore += value
      }
    }
    finalScores.overall = overallScore

    console.log('📊 Final scores object:', finalScores)
    return finalScores
  }

  /**
   * Helper function to map raw score to scaled score using curve data
   * @param rawScore - The raw score (number of correct answers)
   * @param curveData - Array of curve data points
   * @returns The scaled score (middle of the range)
   */
  private static mapRawToScaled(rawScore: number, curveData: any[]): number {
    // Validate inputs
    if (typeof rawScore !== 'number' || rawScore < 0) {
      console.warn(`Invalid raw score: ${rawScore}, using 0`)
      rawScore = 0
    }

    if (!Array.isArray(curveData) || curveData.length === 0) {
      console.error('Empty or invalid curve data, using minimum score')
      return 200 // SAT minimum section score
    }

    // Find the curve data point that matches the raw score
    const curvePoint = curveData.find((point) => point.raw === rawScore)

    if (!curvePoint) {
      // If exact raw score not found, find the closest one or use bounds
      console.warn(
        `Raw score ${rawScore} not found in curve data, using fallback logic`
      )

      // Find the closest available score
      const sortedCurve = [...curveData].sort(
        (a, b) => Math.abs(a.raw - rawScore) - Math.abs(b.raw - rawScore)
      )
      const closestPoint = sortedCurve[0]

      if (
        closestPoint &&
        typeof closestPoint.lower === 'number' &&
        typeof closestPoint.upper === 'number'
      ) {
        const scaledScore = Math.round(
          (closestPoint.lower + closestPoint.upper) / 2
        )
        console.log(
          `Using closest curve point for raw score ${rawScore}: ${closestPoint.raw} → ${scaledScore}`
        )
        return scaledScore
      }

      // Ultimate fallback - use boundary scores
      const minRaw = Math.min(...curveData.map((p) => p.raw))
      const maxRaw = Math.max(...curveData.map((p) => p.raw))

      if (rawScore < minRaw) {
        const minPoint = curveData.find((p) => p.raw === minRaw)
        const minScore = minPoint
          ? Math.round((minPoint.lower + minPoint.upper) / 2)
          : 200
        console.log(
          `Raw score ${rawScore} below minimum ${minRaw}, using minimum scaled score: ${minScore}`
        )
        return minScore
      }

      if (rawScore > maxRaw) {
        const maxPoint = curveData.find((p) => p.raw === maxRaw)
        const maxScore = maxPoint
          ? Math.round((maxPoint.lower + maxPoint.upper) / 2)
          : 800
        console.log(
          `Raw score ${rawScore} above maximum ${maxRaw}, using maximum scaled score: ${maxScore}`
        )
        return maxScore
      }

      console.error(
        `Unable to map raw score ${rawScore}, using fallback score 200`
      )
      return 200 // Minimum SAT section score
    }

    // Validate curve point data
    if (
      typeof curvePoint.lower !== 'number' ||
      typeof curvePoint.upper !== 'number'
    ) {
      console.error(
        `Invalid curve point data: ${JSON.stringify(curvePoint)}, using fallback`
      )
      return 200
    }

    // Calculate the middle of the score range
    const scaledScore = Math.round((curvePoint.lower + curvePoint.upper) / 2)
    console.log(
      `Mapped raw score ${rawScore} to scaled score ${scaledScore} (range: ${curvePoint.lower}-${curvePoint.upper})`
    )
    return scaledScore
  }
}
