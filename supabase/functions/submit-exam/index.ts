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
}

// Helper function to map raw score to scaled score using curve data
function mapRawToScaled(rawScore: number, curveData: any[]): number {
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
  const englishScaledScore = mapRawToScaled(englishRawScore, englishCurve.curve_data)
  const mathScaledScore = mapRawToScaled(mathRawScore, mathCurve.curve_data)

  // Step 7: Calculate overall score
  const overallScore = englishScaledScore + mathScaledScore

  return {
    overall: overallScore,
    english: englishScaledScore,
    math: mathScaledScore
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Missing authorization header', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // Create supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Get the current user to verify authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // Parse request body
    const { attempt_id } = await req.json()
    if (!attempt_id) {
      return new Response('Missing attempt_id', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Verify the user owns this attempt
    const { data: attemptOwner, error: ownerError } = await supabase
      .from('test_attempts')
      .select('user_id')
      .eq('id', attempt_id)
      .single()

    if (ownerError || !attemptOwner) {
      return new Response('Test attempt not found', { 
        status: 404, 
        headers: corsHeaders 
      })
    }

    if (attemptOwner.user_id !== user.id) {
      return new Response('Forbidden: You do not own this test attempt', { 
        status: 403, 
        headers: corsHeaders 
      })
    }

    // Calculate final scores using the scoring service logic
    const finalScores = await calculateFinalScores(supabase, attempt_id)

    // Update the test attempt with completion status and final scores
    const { error: updateError } = await supabase
      .from('test_attempts')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        final_scores: finalScores
      })
      .eq('id', attempt_id)

    if (updateError) {
      throw new Error(`Failed to update test attempt: ${updateError.message}`)
    }

    // Return the final scores
    return new Response(JSON.stringify(finalScores), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    })

  } catch (error) {
    console.error('Error in submit-exam function:', error)
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