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
   * Validate curve data structure and values
   * @param curveData - Array of curve data points
   * @returns boolean - true if valid
   */
  private static validateCurveData(curveData: any[]): boolean {
    if (!Array.isArray(curveData) || curveData.length === 0) {
      throw new Error('Invalid curve data: must be non-empty array')
    }
    
    for (const point of curveData) {
      if (typeof point.raw !== 'number' || 
          typeof point.lower !== 'number' || 
          typeof point.upper !== 'number') {
        throw new Error(`Invalid curve point: ${JSON.stringify(point)}`)
      }
      
      if (point.lower > point.upper) {
        throw new Error(`Invalid curve range: lower (${point.lower}) > upper (${point.upper})`)
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
    return answer && 
           answer.questions && 
           typeof answer.questions.module_type === 'string' &&
           answer.questions.module_type.trim() !== ''
  }
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

    // Step 3: Get all user answers with question details (using inner join to ensure question data exists)
    const { data: answers, error: answersError } = await supabase
      .from('user_answers')
      .select(`
        id,
        user_answer,
        is_correct,
        time_spent_seconds,
        questions:question_id!inner (
          module_type,
          points
        )
      `)
      .eq('attempt_id', attemptId)

    if (answersError) throw new Error(`Failed to get user answers: ${answersError.message}`)
    
    // Validate that all answers have question data
    const invalidAnswers = answers?.filter(a => !this.validateAnswer(a)) || []
    if (invalidAnswers.length > 0) {
      console.warn(`${invalidAnswers.length} answers have invalid question data:`, invalidAnswers)
      throw new Error(`${invalidAnswers.length} answers missing valid question data - possible database integrity issue`)
    }

    // Step 4: Calculate raw scores by subject
    let englishRawScore = 0
    let mathRawScore = 0

    answers?.forEach((answer: any) => {
      // Validate answer structure
      if (!this.validateAnswer(answer)) {
        console.warn('Invalid answer data, skipping:', answer)
        return
      }
      
      if (answer.is_correct) {
        const moduleType = answer.questions.module_type.toLowerCase().trim()
        const points = Math.max(0, Number(answer.questions.points) || 1)

        if (moduleType.includes('english')) {
          englishRawScore += points
        } else if (moduleType.includes('math')) {
          mathRawScore += points
        } else {
          console.warn('Unknown module type:', moduleType, 'for answer:', answer.id)
        }
      }
    })

    // Step 5: Fetch scoring curves with names for debugging
    const { data: englishCurve, error: englishCurveError } = await supabase
      .from('scoring_curves')
      .select('id, curve_name, curve_data')
      .eq('id', examData.english_scoring_curve_id)
      .single()

    if (englishCurveError) throw new Error(`Failed to get English scoring curve: ${englishCurveError.message}`)

    const { data: mathCurve, error: mathCurveError } = await supabase
      .from('scoring_curves')
      .select('id, curve_name, curve_data')
      .eq('id', examData.math_scoring_curve_id)
      .single()

    if (mathCurveError) throw new Error(`Failed to get Math scoring curve: ${mathCurveError.message}`)
    
    console.log('📋 English curve info:', { id: englishCurve.id, name: englishCurve.curve_name })
    console.log('📋 Math curve info:', { id: mathCurve.id, name: mathCurve.curve_name })

    // Step 6: Validate curve data and map raw scores to scaled scores
    this.validateCurveData(englishCurve.curve_data)
    this.validateCurveData(mathCurve.curve_data)
    
    console.log(`Raw scores calculated - English: ${englishRawScore}, Math: ${mathRawScore}`)
    
    const englishScaledScore = this.mapRawToScaled(englishRawScore, englishCurve.curve_data)
    const mathScaledScore = this.mapRawToScaled(mathRawScore, mathCurve.curve_data)
    
    console.log('⚖️ Scaled scores:')
    console.log(`  - English raw ${englishRawScore} → scaled ${englishScaledScore} (using curve: ${englishCurve.curve_name})`)
    console.log(`  - Math raw ${mathRawScore} → scaled ${mathScaledScore} (using curve: ${mathCurve.curve_name})`)

    // Step 7: Calculate overall score
    const overallScore = englishScaledScore + mathScaledScore

    const finalScores = {
      overall: overallScore,
      english: englishScaledScore,
      math: mathScaledScore
    }
    
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
    const curvePoint = curveData.find(point => point.raw === rawScore)
    
    if (!curvePoint) {
      // If exact raw score not found, find the closest one or use bounds
      console.warn(`Raw score ${rawScore} not found in curve data, using fallback logic`)
      
      // Find the closest available score
      const sortedCurve = [...curveData].sort((a, b) => Math.abs(a.raw - rawScore) - Math.abs(b.raw - rawScore))
      const closestPoint = sortedCurve[0]
      
      if (closestPoint && 
          typeof closestPoint.lower === 'number' && 
          typeof closestPoint.upper === 'number') {
        const scaledScore = Math.round((closestPoint.lower + closestPoint.upper) / 2)
        console.log(`Using closest curve point for raw score ${rawScore}: ${closestPoint.raw} → ${scaledScore}`)
        return scaledScore
      }
      
      // Ultimate fallback - use boundary scores
      const minRaw = Math.min(...curveData.map(p => p.raw))
      const maxRaw = Math.max(...curveData.map(p => p.raw))
      
      if (rawScore < minRaw) {
        const minPoint = curveData.find(p => p.raw === minRaw)
        const minScore = minPoint ? Math.round((minPoint.lower + minPoint.upper) / 2) : 200
        console.log(`Raw score ${rawScore} below minimum ${minRaw}, using minimum scaled score: ${minScore}`)
        return minScore
      }
      
      if (rawScore > maxRaw) {
        const maxPoint = curveData.find(p => p.raw === maxRaw)
        const maxScore = maxPoint ? Math.round((maxPoint.lower + maxPoint.upper) / 2) : 800
        console.log(`Raw score ${rawScore} above maximum ${maxRaw}, using maximum scaled score: ${maxScore}`)
        return maxScore
      }
      
      console.error(`Unable to map raw score ${rawScore}, using fallback score 200`)
      return 200 // Minimum SAT section score
    }

    // Validate curve point data
    if (typeof curvePoint.lower !== 'number' || typeof curvePoint.upper !== 'number') {
      console.error(`Invalid curve point data: ${JSON.stringify(curvePoint)}, using fallback`)
      return 200
    }
    
    // Calculate the middle of the score range
    const scaledScore = Math.round((curvePoint.lower + curvePoint.upper) / 2)
    console.log(`Mapped raw score ${rawScore} to scaled score ${scaledScore} (range: ${curvePoint.lower}-${curvePoint.upper})`)
    return scaledScore
  }
}