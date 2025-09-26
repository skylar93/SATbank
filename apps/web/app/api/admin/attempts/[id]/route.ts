import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const attemptId = params.id

    // Verify the attempt exists and get basic info for logging
    const { data: attemptData, error: fetchError } = await supabase
      .from('test_attempts')
      .select('id, user_id, created_at, status')
      .eq('id', attemptId)
      .single()

    if (fetchError || !attemptData) {
      return NextResponse.json(
        { error: 'Test attempt not found' },
        { status: 404 }
      )
    }

    // Start transaction by deleting related records first
    // Delete user answers first (foreign key dependency)
    const { error: answersError } = await supabase
      .from('user_answers')
      .delete()
      .eq('attempt_id', attemptId)

    if (answersError) {
      console.error('Error deleting user answers:', answersError)
      return NextResponse.json(
        { error: 'Failed to delete related answer records' },
        { status: 500 }
      )
    }

    // Delete the test attempt
    const { error: attemptError } = await supabase
      .from('test_attempts')
      .delete()
      .eq('id', attemptId)

    if (attemptError) {
      console.error('Error deleting test attempt:', attemptError)
      return NextResponse.json(
        { error: 'Failed to delete test attempt' },
        { status: 500 }
      )
    }

    // Log the deletion for audit purposes
    console.log(
      `Admin deleted test attempt ${attemptId} for user ${attemptData.user_id}`
    )

    return NextResponse.json(
      {
        success: true,
        message: 'Test attempt deleted successfully',
        deletedAttemptId: attemptId,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error during attempt deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
