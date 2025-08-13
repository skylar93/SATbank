import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ScoringService } from '../../../../lib/scoring-service'

interface RegradeQuestionRequest {
  userAnswerId: string
  newIsCorrect: boolean
  reason: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    console.log('Auth check - User:', user?.id, 'Error:', authError?.message)
    
    if (authError || !user) {
      console.log('No user or auth error:', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('Profile check - Profile:', profile, 'Error:', profileError?.message)

    if (profileError || !profile || profile.role !== 'admin') {
      console.log('Not admin or profile error:', profileError?.message, 'Role:', profile?.role)
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body: RegradeQuestionRequest = await request.json()
    const { userAnswerId, newIsCorrect, reason } = body

    // Validate input
    if (!userAnswerId || typeof newIsCorrect !== 'boolean' || !reason?.trim()) {
      return NextResponse.json({ 
        error: 'Missing required fields: userAnswerId, newIsCorrect, reason' 
      }, { status: 400 })
    }

    // Get the user answer with attempt info
    const { data: userAnswer, error: answerError } = await supabase
      .from('user_answers')
      .select(`
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
      `)
      .eq('id', userAnswerId)
      .single()

    if (answerError || !userAnswer) {
      return NextResponse.json({ error: 'User answer not found' }, { status: 404 })
    }

    // Check if the attempt is completed
    if (userAnswer.test_attempts?.status !== 'completed') {
      return NextResponse.json({ 
        error: 'Can only regrade completed attempts' 
      }, { status: 400 })
    }

    const oldIsCorrect = userAnswer.is_correct
    
    // Don't update if the value is the same
    if (oldIsCorrect === newIsCorrect) {
      return NextResponse.json({ 
        error: 'New grading result is the same as current result' 
      }, { status: 400 })
    }

    // Update the user answer
    const { error: updateError } = await supabase
      .from('user_answers')
      .update({ is_correct: newIsCorrect })
      .eq('id', userAnswerId)

    if (updateError) {
      throw new Error(`Failed to update user answer: ${updateError.message}`)
    }

    // Log the regrade action
    const { error: logError } = await supabase
      .from('regrade_history')
      .insert({
        user_answer_id: userAnswerId,
        attempt_id: userAnswer.attempt_id,
        admin_id: user.id,
        old_is_correct: oldIsCorrect,
        new_is_correct: newIsCorrect,
        reason: reason.trim(),
        regraded_at: new Date().toISOString()
      })

    if (logError) {
      console.error('Failed to log regrade action:', logError)
      // Don't fail the request for logging errors
    }

    // Recalculate scores for the entire attempt
    try {
      const newScores = await ScoringService.calculateFinalScores(userAnswer.attempt_id)
      
      // Update the test attempt with new scores
      const { error: scoreUpdateError } = await supabase
        .from('test_attempts')
        .update({
          total_score: newScores.overall,
          final_scores: {
            overall: newScores.overall,
            english: newScores.english,
            math: newScores.math
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', userAnswer.attempt_id)

      if (scoreUpdateError) {
        throw new Error(`Failed to update attempt scores: ${scoreUpdateError.message}`)
      }

      return NextResponse.json({
        success: true,
        message: 'Question regraded successfully',
        oldIsCorrect,
        newIsCorrect,
        newScores
      })

    } catch (scoringError: any) {
      // If scoring fails, revert the user answer change
      await supabase
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