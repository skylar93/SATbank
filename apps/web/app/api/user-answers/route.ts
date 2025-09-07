import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Check for impersonation data in request headers
    const impersonationHeader = request.headers.get('x-impersonation-data')
    let targetUserId = user.id

    if (impersonationHeader) {
      try {
        const impersonationData = JSON.parse(impersonationHeader)
        if (impersonationData.target_user && impersonationData.target_user.id) {
          // Verify that the current user is an admin when impersonating
          const { data: userProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', user.id)
            .single()

          if (profileError || !userProfile || userProfile.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized: Admin access required for impersonation' }, { status: 401 })
          }

          targetUserId = impersonationData.target_user.id
          console.log('API: Admin', user.email, 'submitting answer for impersonated user:', targetUserId)
        }
      } catch (error) {
        console.error('Failed to parse impersonation data:', error)
        return NextResponse.json({ error: 'Invalid impersonation data' }, { status: 400 })
      }
    }

    // For user answers, we need to ensure the answer belongs to the target user
    // by checking that the attempt_id belongs to the target user
    const { data: attemptData, error: attemptError } = await supabase
      .from('test_attempts')
      .select('user_id')
      .eq('id', body.attempt_id)
      .single()

    if (attemptError || !attemptData) {
      return NextResponse.json({ error: 'Test attempt not found' }, { status: 404 })
    }

    if (attemptData.user_id !== targetUserId) {
      return NextResponse.json({ error: 'Unauthorized: Test attempt does not belong to user' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('user_answers')
      .upsert(body, { onConflict: 'attempt_id,question_id' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}