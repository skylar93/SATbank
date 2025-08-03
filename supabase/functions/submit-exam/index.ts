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

  console.log('📝 Processing answers:', answers?.length, 'total answers')
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

  console.log('🔢 Raw scores calculated - English:', englishRawScore, 'Math:', mathRawScore)

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
  console.log('📊 English curve data:', englishCurve.curve_data)
  console.log('📊 Math curve data:', mathCurve.curve_data)
  
  const englishScaledScore = mapRawToScaled(englishRawScore, englishCurve.curve_data)
  const mathScaledScore = mapRawToScaled(mathRawScore, mathCurve.curve_data)
  
  console.log('⚖️ Scaled scores - English:', englishScaledScore, 'Math:', mathScaledScore)

  // Step 7: Calculate overall score
  const overallScore = englishScaledScore + mathScaledScore
  
  console.log('🎯 Final overall score:', overallScore)

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

    // Update the test attempt with completion status and final scores
    console.log('💾 Updating test attempt in database')
    const { error: updateError } = await supabase
      .from('test_attempts')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        final_scores: finalScores
      })
      .eq('id', attempt_id)

    if (updateError) {
      console.error('❌ Failed to update test attempt:', updateError.message)
      throw new Error(`Failed to update test attempt: ${updateError.message}`)
    }
    console.log('✅ Test attempt updated successfully')

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