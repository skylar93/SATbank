#!/usr/bin/env node

/**
 * Script to fix incorrect final scores for a specific test attempt
 * 
 * This script will:
 * 1. Find the test attempt for kayla@lim.sat user from August 10, 2025
 * 2. Recalculate the scores using the current ScoringService
 * 3. Update the final_scores column with the correct values
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Manual environment variable loading from .env.local
function loadEnvVars() {
  const envPath = path.join(__dirname, 'apps/web/.env.local')
  const envVars = {}
  
  try {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const lines = envContent.split('\n')
    
    lines.forEach(line => {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '') // Remove quotes
          envVars[key] = value
        }
      }
    })
  } catch (error) {
    console.warn('Could not load .env.local file:', error.message)
  }
  
  return envVars
}

// Load environment variables
const envVars = loadEnvVars()
const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables!')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in apps/web/.env.local')
  process.exit(1)
}

// Create admin client (using service role key for full access)
const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Validate curve data structure and values
 */
function validateCurveData(curveData) {
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
 * Helper function to map raw score to scaled score using curve data
 */
function mapRawToScaled(rawScore, curveData) {
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
    return 200
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

/**
 * Calculate final scaled scores for a completed exam attempt
 */
async function calculateFinalScores(attemptId) {
  console.log(`🔍 Calculating final scores for attempt ID: ${attemptId}`)
  
  // Step 1: Get the exam_id for the given attemptId
  const { data: attemptData, error: attemptError } = await supabase
    .from('test_attempts')
    .select('exam_id, user_id, created_at')
    .eq('id', attemptId)
    .single()

  if (attemptError) throw new Error(`Failed to get attempt data: ${attemptError.message}`)
  if (!attemptData) throw new Error(`Test attempt ${attemptId} not found`)

  console.log(`📋 Found attempt: exam_id=${attemptData.exam_id}, user_id=${attemptData.user_id}, created_at=${attemptData.created_at}`)

  // Step 2: Get the scoring curve IDs from the exam
  const { data: examData, error: examError } = await supabase
    .from('exams')
    .select('english_scoring_curve_id, math_scoring_curve_id, title')
    .eq('id', attemptData.exam_id)
    .single()

  if (examError) throw new Error(`Failed to get exam data: ${examError.message}`)
  if (!examData?.english_scoring_curve_id || !examData?.math_scoring_curve_id) {
    throw new Error(`Exam ${attemptData.exam_id} does not have scoring curves assigned`)
  }

  console.log(`📋 Exam: ${examData.title}`)
  console.log(`📊 English curve ID: ${examData.english_scoring_curve_id}, Math curve ID: ${examData.math_scoring_curve_id}`)

  // Step 3: Get all user answers with question details
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
  
  console.log(`📝 Found ${answers?.length || 0} user answers`)

  // Step 4: Calculate raw scores by subject
  let englishRawScore = 0
  let mathRawScore = 0

  answers?.forEach((answer) => {
    if (answer.is_correct && answer.questions) {
      const moduleType = answer.questions.module_type?.toLowerCase().trim()
      const points = Math.max(0, Number(answer.questions.points) || 1)

      if (moduleType?.includes('english')) {
        englishRawScore += points
      } else if (moduleType?.includes('math')) {
        mathRawScore += points
      } else {
        console.warn('Unknown module type:', moduleType, 'for answer:', answer.id)
      }
    }
  })

  console.log(`📊 Raw scores calculated - English: ${englishRawScore}, Math: ${mathRawScore}`)

  // Step 5: Fetch scoring curves
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
  
  console.log(`📋 English curve: ${englishCurve.curve_name}`)
  console.log(`📋 Math curve: ${mathCurve.curve_name}`)

  // Step 6: Validate curve data and map raw scores to scaled scores
  validateCurveData(englishCurve.curve_data)
  validateCurveData(mathCurve.curve_data)
  
  const englishScaledScore = mapRawToScaled(englishRawScore, englishCurve.curve_data)
  const mathScaledScore = mapRawToScaled(mathRawScore, mathCurve.curve_data)
  
  console.log(`⚖️ Scaled scores:`)
  console.log(`  - English raw ${englishRawScore} → scaled ${englishScaledScore} (using curve: ${englishCurve.curve_name})`)
  console.log(`  - Math raw ${mathRawScore} → scaled ${mathScaledScore} (using curve: ${mathCurve.curve_name})`)

  // Step 7: Calculate overall score
  const overallScore = englishScaledScore + mathScaledScore

  const finalScores = {
    overall: overallScore,
    english: englishScaledScore,
    math: mathScaledScore
  }
  
  console.log(`📊 Final scores object:`, finalScores)
  return finalScores
}

/**
 * Find test attempt by user email and date
 */
async function findTestAttempt(userEmail, targetDate) {
  console.log(`🔍 Searching for test attempts for user: ${userEmail} on date: ${targetDate}`)
  
  // First, get the user ID from the email
  const { data: userData, error: userError } = await supabase
    .from('user_profiles')
    .select('id, email, full_name')
    .eq('email', userEmail)
    .single()

  if (userError) {
    console.error('Failed to find user:', userError.message)
    return null
  }

  console.log(`👤 Found user: ${userData.full_name} (${userData.email})`)

  // Find test attempts for this user on the target date
  const { data: attempts, error: attemptsError } = await supabase
    .from('test_attempts')
    .select(`
      id,
      exam_id,
      status,
      created_at,
      completed_at,
      final_scores,
      exams:exam_id (
        title
      )
    `)
    .eq('user_id', userData.id)
    .gte('created_at', `${targetDate}T00:00:00Z`)
    .lt('created_at', `${targetDate}T23:59:59Z`)
    .order('created_at', { ascending: false })

  if (attemptsError) {
    console.error('Failed to find attempts:', attemptsError.message)
    return null
  }

  console.log(`📋 Found ${attempts?.length || 0} test attempts on ${targetDate}`)
  
  if (attempts && attempts.length > 0) {
    attempts.forEach((attempt, index) => {
      console.log(`  ${index + 1}. Attempt ID: ${attempt.id}`)
      console.log(`     Exam: ${attempt.exams?.title || 'Unknown'}`)
      console.log(`     Status: ${attempt.status}`)
      console.log(`     Created: ${attempt.created_at}`)
      console.log(`     Completed: ${attempt.completed_at || 'Not completed'}`)
      console.log(`     Current Final Scores:`, attempt.final_scores)
      console.log('')
    })
    
    return attempts
  }
  
  return null
}

/**
 * Update the final_scores in the database
 */
async function updateFinalScores(attemptId, finalScores) {
  console.log(`💾 Updating final scores for attempt ID: ${attemptId}`)
  console.log(`📊 New scores:`, finalScores)
  
  const { data, error } = await supabase
    .from('test_attempts')
    .update({ final_scores: finalScores })
    .eq('id', attemptId)
    .select('id, final_scores')

  if (error) {
    throw new Error(`Failed to update final scores: ${error.message}`)
  }

  console.log(`✅ Successfully updated final scores for attempt ${attemptId}`)
  return data
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Starting score recalculation script...')
    
    const userEmail = 'kayla@lim.sat'
    const targetDate = '2025-08-10'  // Adjust this date as needed
    
    // Let's also check a broader date range to find attempts with actual answers
    console.log('\n🔍 Checking for test attempts with recorded answers...')
    
    // Get user ID first
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email, full_name')
      .eq('email', userEmail)
      .single()

    if (userError) {
      console.error('Failed to find user:', userError.message)
      return
    }
    
    // Find all completed test attempts for this user that have answers
    const { data: attemptsWithAnswers, error: attemptsWithAnswersError } = await supabase
      .from('test_attempts')
      .select(`
        id,
        exam_id,
        status,
        created_at,
        completed_at,
        final_scores,
        exams:exam_id (
          title
        )
      `)
      .eq('user_id', userData.id)
      .in('status', ['completed', 'expired'])
      .order('created_at', { ascending: false })
      .limit(10)

    if (attemptsWithAnswersError) {
      console.error('Failed to find attempts with answers:', attemptsWithAnswersError.message)
    } else if (attemptsWithAnswers && attemptsWithAnswers.length > 0) {
      console.log(`📋 Found ${attemptsWithAnswers.length} completed/expired attempts:`)
      
      for (let i = 0; i < attemptsWithAnswers.length; i++) {
        const attempt = attemptsWithAnswers[i]
        
        // Check how many answers this attempt has
        const { data: answerCount, error: answerCountError } = await supabase
          .from('user_answers')
          .select('id', { count: 'exact' })
          .eq('attempt_id', attempt.id)

        const count = answerCountError ? 'Error' : (answerCount?.length || 0)
        
        console.log(`  ${i + 1}. Attempt ID: ${attempt.id}`)
        console.log(`     Exam: ${attempt.exams?.title || 'Unknown'}`)
        console.log(`     Status: ${attempt.status}`)
        console.log(`     Created: ${attempt.created_at}`)
        console.log(`     Answer count: ${count}`)
        console.log(`     Current Final Scores:`, attempt.final_scores)
        console.log('')
      }
      
      // Find the attempt with the most answers (likely the completed one)
      let bestAttempt = null
      let maxAnswers = 0
      
      for (const attempt of attemptsWithAnswers) {
        const { data: answers } = await supabase
          .from('user_answers')
          .select('id', { count: 'exact' })
          .eq('attempt_id', attempt.id)
        
        const count = answers?.length || 0
        if (count > maxAnswers) {
          maxAnswers = count
          bestAttempt = attempt
        }
      }
      
      if (bestAttempt && maxAnswers > 0) {
        console.log(`🎯 Found best candidate attempt with ${maxAnswers} answers: ${bestAttempt.id}`)
        console.log(`📋 Processing this attempt instead...`)
        
        // Process this attempt instead
        const newScores = await calculateFinalScores(bestAttempt.id)
        
        console.log('\n📊 SCORE COMPARISON:')
        console.log('Current scores:', bestAttempt.final_scores)
        console.log('Recalculated scores:', newScores)
        
        if (bestAttempt.final_scores) {
          const oldScores = bestAttempt.final_scores
          console.log('\n🔄 Changes:')
          console.log(`  Overall: ${oldScores.overall || 'N/A'} → ${newScores.overall} (${newScores.overall - (oldScores.overall || 0) > 0 ? '+' : ''}${newScores.overall - (oldScores.overall || 0)})`)
          console.log(`  English: ${oldScores.english || 'N/A'} → ${newScores.english} (${newScores.english - (oldScores.english || 0) > 0 ? '+' : ''}${newScores.english - (oldScores.english || 0)})`)
          console.log(`  Math: ${oldScores.math || 'N/A'} → ${newScores.math} (${newScores.math - (oldScores.math || 0) > 0 ? '+' : ''}${newScores.math - (oldScores.math || 0)})`)
        }
        
        console.log('\n❓ Proceeding to update the database with the new scores...')
        await updateFinalScores(bestAttempt.id, newScores)
        console.log('\n✅ Score recalculation completed successfully!')
        return
      }
    }
    
    // Step 1: Find the test attempt
    const attempts = await findTestAttempt(userEmail, targetDate)
    
    if (!attempts || attempts.length === 0) {
      console.log('❌ No test attempts found for the specified criteria.')
      return
    }
    
    // For now, process the first (most recent) attempt
    // You can modify this logic to select a specific attempt
    const targetAttempt = attempts[0]
    
    console.log(`🎯 Processing attempt: ${targetAttempt.id}`)
    console.log(`📋 Current scores:`, targetAttempt.final_scores)
    
    // Step 2: Recalculate the scores
    const newScores = await calculateFinalScores(targetAttempt.id)
    
    // Step 3: Compare old vs new scores
    console.log('\n📊 SCORE COMPARISON:')
    console.log('Current scores:', targetAttempt.final_scores)
    console.log('Recalculated scores:', newScores)
    
    if (targetAttempt.final_scores) {
      const oldScores = targetAttempt.final_scores
      console.log('\n🔄 Changes:')
      console.log(`  Overall: ${oldScores.overall || 'N/A'} → ${newScores.overall} (${newScores.overall - (oldScores.overall || 0) > 0 ? '+' : ''}${newScores.overall - (oldScores.overall || 0)})`)
      console.log(`  English: ${oldScores.english || 'N/A'} → ${newScores.english} (${newScores.english - (oldScores.english || 0) > 0 ? '+' : ''}${newScores.english - (oldScores.english || 0)})`)
      console.log(`  Math: ${oldScores.math || 'N/A'} → ${newScores.math} (${newScores.math - (oldScores.math || 0) > 0 ? '+' : ''}${newScores.math - (oldScores.math || 0)})`)
    }
    
    // Step 4: Ask for confirmation (in a real script, you might want to add a prompt)
    console.log('\n❓ Proceeding to update the database with the new scores...')
    
    // Step 5: Update the database
    await updateFinalScores(targetAttempt.id, newScores)
    
    console.log('\n✅ Score recalculation completed successfully!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main()
}