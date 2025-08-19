import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScoringCurve {
  id: number
  name: string
  curve_data: {
    raw: number
    lower: number
    upper: number
  }[]
}

interface FinalScores {
  overall: number
  english: number
  math: number
  moduleScores: {
    english1: number
    english2: number
    math1: number
    math2: number
  }
}

// Helper function to validate curve data structure and values
function validateCurveData(curveData: any[]): boolean {
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

// Helper function to validate answer data structure
function validateAnswer(answer: any): boolean {
  return answer && 
         answer.questions && 
         typeof answer.questions.module_type === 'string' &&
         answer.questions.module_type.trim() !== ''
}

// Helper function to map raw score to scaled score using curve data
function mapRawToScaled(rawScore: number, curveData: any[]): number {
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

// Calculate final scaled scores for a completed exam attempt
async function calculateFinalScores(supabase: any, attemptId: string): Promise<FinalScores> {
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
  const invalidAnswers = answers?.filter(a => !validateAnswer(a)) || []
  if (invalidAnswers.length > 0) {
    console.warn(`${invalidAnswers.length} answers have invalid question data:`, invalidAnswers)
    throw new Error(`${invalidAnswers.length} answers missing valid question data - possible database integrity issue`)
  }

  // Step 4: Calculate raw scores by subject and module
  let englishRawScore = 0
  let mathRawScore = 0
  
  // Module-specific scores
  const moduleScores = {
    english1: 0,
    english2: 0,
    math1: 0,
    math2: 0
  }

  console.log('📝 Processing answers:', answers?.length, 'total answers')
  answers?.forEach((answer: any) => {
    // Validate answer structure
    if (!validateAnswer(answer)) {
      console.warn('Invalid answer data, skipping:', answer)
      return
    }
    
    if (answer.is_correct) {
      const moduleType = answer.questions.module_type.toLowerCase().trim()
      const points = Math.max(0, Number(answer.questions.points) || 1)

      // Add to overall subject scores
      if (moduleType.includes('english')) {
        englishRawScore += points
      } else if (moduleType.includes('math')) {
        mathRawScore += points
      } else {
        console.warn('Unknown module type:', moduleType, 'for answer:', answer.id)
      }

      // Add to specific module scores
      if (moduleType === 'english1') {
        moduleScores.english1 += points
      } else if (moduleType === 'english2') {
        moduleScores.english2 += points
      } else if (moduleType === 'math1') {
        moduleScores.math1 += points
      } else if (moduleType === 'math2') {
        moduleScores.math2 += points
      }
    }
  })

  console.log('🔢 Raw scores calculated - English:', englishRawScore, 'Math:', mathRawScore)
  console.log('🔢 Module scores calculated:', moduleScores)

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
  console.log('📊 English curve data:', englishCurve.curve_data)
  console.log('📊 Math curve data:', mathCurve.curve_data)
  
  // Validate curve data before processing
  validateCurveData(englishCurve.curve_data)
  validateCurveData(mathCurve.curve_data)
  
  console.log(`🔢 Raw scores calculated - English: ${englishRawScore}, Math: ${mathRawScore}`)
  
  const englishScaledScore = mapRawToScaled(englishRawScore, englishCurve.curve_data)
  const mathScaledScore = mapRawToScaled(mathRawScore, mathCurve.curve_data)
  
  console.log('⚖️ Scaled scores:')
  console.log(`  - English raw ${englishRawScore} → scaled ${englishScaledScore} (using curve: ${englishCurve.curve_name})`)
  console.log(`  - Math raw ${mathRawScore} → scaled ${mathScaledScore} (using curve: ${mathCurve.curve_name})`)

  // Step 7: Calculate overall score
  const overallScore = englishScaledScore + mathScaledScore
  
  console.log('🎯 Final overall score:', overallScore)

  const finalScores = {
    overall: overallScore,
    english: englishScaledScore,
    math: mathScaledScore,
    moduleScores: moduleScores
  }
  
  console.log('📊 Final scores object:', finalScores)
  return finalScores
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Submit exam function started')
    console.log('Request method:', req.method)
    console.log('Request headers:', Object.fromEntries(req.headers.entries()))

    // Create supabase client with service role for testing
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    console.log('🔗 Creating Supabase client with service role (TESTING)')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('⚠️ SKIPPING AUTHENTICATION FOR TESTING')

    // Parse request body
    console.log('📝 Parsing request body')
    const { attempt_id } = await req.json()
    console.log('Received attempt_id:', attempt_id)
    
    if (!attempt_id) {
      console.error('❌ Missing attempt_id')
      return new Response(JSON.stringify({ error: 'Missing attempt_id' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('⚠️ SKIPPING OWNERSHIP VERIFICATION FOR TESTING')

    // Calculate final scores using the scoring service logic
    console.log('📊 Calculating final scores')
    const finalScores = await calculateFinalScores(supabase, attempt_id)
    console.log('✅ Final scores calculated:', finalScores)

    // Update the test attempt with completion status, final scores, and module scores
    console.log('💾 Updating test attempt in database')
    const { error: updateError } = await supabase
      .from('test_attempts')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        final_scores: finalScores,
        module_scores: finalScores.moduleScores,
        total_score: finalScores.overall
      })
      .eq('id', attempt_id)

    if (updateError) {
      console.error('❌ Failed to update test attempt:', updateError.message)
      throw new Error(`Failed to update test attempt: ${updateError.message}`)
    }
    console.log('✅ Test attempt updated successfully')

    // Populate mistake bank with incorrect answers
    console.log('📚 Populating mistake bank with incorrect answers')
    try {
      // Get the user_id from the test attempt
      const { data: attemptData, error: attemptFetchError } = await supabase
        .from('test_attempts')
        .select('user_id')
        .eq('id', attempt_id)
        .single()

      if (attemptFetchError || !attemptData) {
        console.error('❌ Failed to fetch attempt user_id:', attemptFetchError?.message)
      } else {
        // Fetch all user answers for this attempt
        const { data: userAnswers, error: answersError } = await supabase
          .from('user_answers')
          .select('question_id, is_correct')
          .eq('attempt_id', attempt_id)

        if (answersError) {
          console.error('❌ Failed to fetch user answers:', answersError.message)
        } else if (userAnswers) {
          // Filter for incorrect answers and prepare for mistake bank
          const mistakes = userAnswers
            .filter(ans => ans.is_correct === false)
            .map(ans => ({
              user_id: attemptData.user_id,
              question_id: ans.question_id,
              status: 'unmastered' as const
            }))

          if (mistakes.length > 0) {
            console.log(`📚 Found ${mistakes.length} mistakes to add to mistake bank`)
            const { error: mistakeError } = await supabase
              .from('mistake_bank')
              .upsert(mistakes, { onConflict: 'user_id, question_id' })

            if (mistakeError) {
              console.error('❌ Failed to populate mistake bank:', mistakeError.message)
            } else {
              console.log('✅ Mistake bank populated successfully')
            }
          } else {
            console.log('📚 No mistakes found - perfect score!')
          }
        }
      }
    } catch (mistakeError) {
      console.error('❌ Error in mistake bank population (non-critical):', mistakeError)
    }

    // Return the final scores
    console.log('📤 Returning final scores to client')
    return new Response(JSON.stringify(finalScores), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    })

  } catch (error) {
    console.error('💥 CRITICAL ERROR in submit-exam function:', error)
    console.error('Error stack:', error.stack)
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    })
  }
})