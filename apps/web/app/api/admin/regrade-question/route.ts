import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { ScoringService } from '../../../../lib/scoring-service'

interface RegradeQuestionRequest {
  userAnswerId: string
  newIsCorrect: boolean
  reason: string
}

export async function POST(request: NextRequest) {
  console.log('🚀 REGRADE API CALLED!')
  console.log('Environment variables check:')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING')
  console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING')
  try {
    const cookieStore = cookies()
    console.log(
      'Available cookies:',
      cookieStore.getAll().map((c) => c.name)
    )
    console.log('Authorization header:', request.headers.get('authorization'))

    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Try to get access token from header if cookies don't work
    const authHeader = request.headers.get('authorization')
    let user = null
    let authError = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const result = await supabase.auth.getUser(token)
      user = result.data.user
      authError = result.error
    } else {
      // Fallback to cookies
      const result = await supabase.auth.getUser()
      user = result.data.user
      authError = result.error
    }

    console.log(
      'Auth check - User:',
      user?.id,
      'Email:',
      user?.email,
      'Error:',
      authError?.message
    )

    if (authError || !user) {
      console.log('No user or auth error:', authError?.message)
      console.log('Request headers:', Object.fromEntries(request.headers.entries()))
      return NextResponse.json({ 
        error: 'Unauthorized', 
        details: authError?.message || 'No user found',
        timestamp: new Date().toISOString()
      }, { status: 401 })
    }

    // Check admin role using user metadata
    console.log('User metadata:', user.user_metadata)
    console.log('App metadata:', user.app_metadata)
    console.log('User email:', user.email)

    // Special case for admin@admin.sat - hardcode admin role
    let userRole = user.user_metadata?.role || user.app_metadata?.role

    if (user.email === 'admin@admin.sat') {
      userRole = 'admin'
      console.log('Hardcoded admin role for admin@admin.sat')
    }

    if (!userRole) {
      // Fallback to user_profiles table
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle() // Use maybeSingle instead of single to handle RLS issues

      userRole = profile?.role

      console.log(
        'Profile fallback - Profile:',
        profile,
        'Error:',
        profileError?.message,
        'Error code:',
        profileError?.code,
        'User ID:',
        user.id
      )
    }

    console.log('Final user role:', userRole)

    if (userRole !== 'admin') {
      console.log('Not admin - Role:', userRole)
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body: RegradeQuestionRequest = await request.json()
    const { userAnswerId, newIsCorrect, reason } = body

    console.log('Regrade request body:', { userAnswerId, newIsCorrect, reason })

    // Validate input
    if (!userAnswerId || typeof newIsCorrect !== 'boolean' || !reason?.trim()) {
      console.log('Validation failed:', { userAnswerId, newIsCorrect, reason })
      return NextResponse.json(
        {
          error: 'Missing required fields: userAnswerId, newIsCorrect, reason',
        },
        { status: 400 }
      )
    }

    // Get the user answer with attempt info
    console.log('Looking for user answer with ID:', userAnswerId)

    // Check if service role key is available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceKey) {
      console.error('Missing required environment variables for service role client')
      return NextResponse.json(
        { 
          error: 'supabaseKey is required', 
          details: 'Server configuration error: Missing environment variables' 
        },
        { status: 500 }
      )
    }

    // Temporarily use service role to bypass RLS for debugging
    const supabaseService = createClient(
      supabaseUrl,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: userAnswer, error: answerError } = await supabaseService
      .from('user_answers')
      .select(
        `
        id,
        attempt_id,
        question_id,
        user_answer,
        is_correct,
        test_attempts:attempt_id (
          id,
          user_id,
          exam_id,
          status
        )
      `
      )
      .eq('id', userAnswerId)
      .maybeSingle()

    console.log('User answer query result:', { userAnswer, answerError })

    if (answerError || !userAnswer) {
      console.log(
        'User answer not found - Error:',
        answerError?.message,
        'Data:',
        userAnswer
      )
      return NextResponse.json(
        { error: 'User answer not found' },
        { status: 404 }
      )
    }

    // Check if the attempt is completed
    if ((userAnswer.test_attempts as any)?.status !== 'completed') {
      return NextResponse.json(
        {
          error: 'Can only regrade completed attempts',
        },
        { status: 400 }
      )
    }

    const oldIsCorrect = userAnswer.is_correct

    // Don't update if the value is the same
    if (oldIsCorrect === newIsCorrect) {
      return NextResponse.json(
        {
          error: 'New grading result is the same as current result',
        },
        { status: 400 }
      )
    }

    // Update the user answer using service role to ensure it gets updated
    const { error: updateError } = await supabaseService
      .from('user_answers')
      .update({ is_correct: newIsCorrect })
      .eq('id', userAnswerId)

    if (updateError) {
      throw new Error(`Failed to update user answer: ${updateError.message}`)
    }

    // Log the regrade action using service role
    const { error: logError } = await supabaseService
      .from('regrade_history')
      .insert({
        user_answer_id: userAnswerId,
        attempt_id: userAnswer.attempt_id,
        admin_id: user.id,
        old_is_correct: oldIsCorrect,
        new_is_correct: newIsCorrect,
        reason: reason.trim(),
        regraded_at: new Date().toISOString(),
      })

    if (logError) {
      console.error('Failed to log regrade action:', logError)
      // Don't fail the request for logging errors
    }

    // Recalculate scores for the entire attempt
    try {
      const newScores = await ScoringService.calculateFinalScores(
        userAnswer.attempt_id,
        true // Use service role for admin operations
      )

      // Update the test attempt with new scores using service role
      const { error: scoreUpdateError } = await supabaseService
        .from('test_attempts')
        .update({
          total_score: newScores.overall,
          final_scores: {
            overall: newScores.overall,
            english: newScores.english,
            math: newScores.math,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', userAnswer.attempt_id)

      if (scoreUpdateError) {
        throw new Error(
          `Failed to update attempt scores: ${scoreUpdateError.message}`
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Question regraded successfully',
        oldIsCorrect,
        newIsCorrect,
        newScores,
      })
    } catch (scoringError: any) {
      // If scoring fails, revert the user answer change using service role
      await supabaseService
        .from('user_answers')
        .update({ is_correct: oldIsCorrect })
        .eq('id', userAnswerId)

      throw new Error(`Scoring calculation failed: ${scoringError.message}`)
    }
  } catch (error: any) {
    console.error('Regrade question error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
