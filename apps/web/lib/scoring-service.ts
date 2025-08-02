import { supabase } from './supabase'

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
  english: number
  math: number
}

export class ScoringService {
  /**
   * Calculate final scaled scores for a completed exam attempt
   * @param attemptId - UUID of the test attempt
   * @returns Promise<FinalScores> - The calculated scaled scores
   */
  static async calculateFinalScores(attemptId: string): Promise<FinalScores> {
    // Step 1: Get the exam_id for the given attemptId
    const { data: attemptData, error: attemptError } = await supabase
      .from('test_attempts')
      .select('exam_id')
      .eq('id', attemptId)
      .single()

    if (attemptError) throw new Error(`Failed to get attempt data: ${attemptError.message}`)
    if (!attemptData) throw new Error(`Test attempt ${attemptId} not found`)

    // Step 2: Get the scoring curve IDs from the exam
    const { data: examData, error: examError } = await supabase
      .from('exams')
      .select('english_scoring_curve_id, math_scoring_curve_id')
      .eq('id', attemptData.exam_id)
      .single()

    if (examError) throw new Error(`Failed to get exam data: ${examError.message}`)
    if (!examData?.english_scoring_curve_id || !examData?.math_scoring_curve_id) {
      throw new Error(`Exam ${attemptData.exam_id} does not have scoring curves assigned`)
    }

    // Step 3: Get all user answers with question details
    const { data: answers, error: answersError } = await supabase
      .from('user_answers')
      .select(`
        *,
        questions:question_id (
          module_type,
          points
        )
      `)
      .eq('attempt_id', attemptId)

    if (answersError) throw new Error(`Failed to get user answers: ${answersError.message}`)

    // Step 4: Calculate raw scores by subject
    let englishRawScore = 0
    let mathRawScore = 0

    answers?.forEach((answer: any) => {
      if (answer.is_correct && answer.questions) {
        const moduleType = answer.questions.module_type
        const points = answer.questions.points || 1

        if (moduleType.startsWith('english')) {
          englishRawScore += points
        } else if (moduleType.startsWith('math')) {
          mathRawScore += points
        }
      }
    })

    // Step 5: Fetch scoring curves
    const { data: englishCurve, error: englishCurveError } = await supabase
      .from('scoring_curves')
      .select('curve_data')
      .eq('id', examData.english_scoring_curve_id)
      .single()

    if (englishCurveError) throw new Error(`Failed to get English scoring curve: ${englishCurveError.message}`)

    const { data: mathCurve, error: mathCurveError } = await supabase
      .from('scoring_curves')
      .select('curve_data')
      .eq('id', examData.math_scoring_curve_id)
      .single()

    if (mathCurveError) throw new Error(`Failed to get Math scoring curve: ${mathCurveError.message}`)

    // Step 6: Map raw scores to scaled scores
    const englishScaledScore = this.mapRawToScaled(englishRawScore, englishCurve.curve_data)
    const mathScaledScore = this.mapRawToScaled(mathRawScore, mathCurve.curve_data)

    // Step 7: Calculate overall score
    const overallScore = englishScaledScore + mathScaledScore

    return {
      overall: overallScore,
      english: englishScaledScore,
      math: mathScaledScore
    }
  }

  /**
   * Helper function to map raw score to scaled score using curve data
   * @param rawScore - The raw score (number of correct answers)
   * @param curveData - Array of curve data points
   * @returns The scaled score (middle of the range)
   */
  private static mapRawToScaled(rawScore: number, curveData: any[]): number {
    // Find the curve data point that matches the raw score
    const curvePoint = curveData.find(point => point.raw === rawScore)
    
    if (!curvePoint) {
      // If exact raw score not found, find the closest one or use bounds
      console.warn(`Raw score ${rawScore} not found in curve data, using fallback logic`)
      
      // Find the closest available score
      const sortedCurve = [...curveData].sort((a, b) => Math.abs(a.raw - rawScore) - Math.abs(b.raw - rawScore))
      const closestPoint = sortedCurve[0]
      
      if (closestPoint) {
        return Math.round((closestPoint.lower + closestPoint.upper) / 2)
      }
      
      // Ultimate fallback
      return 200 // Minimum SAT section score
    }

    // Calculate the middle of the score range
    return Math.round((curvePoint.lower + curvePoint.upper) / 2)
  }
}