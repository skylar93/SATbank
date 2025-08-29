import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

interface UpdateVisibilityRequest {
  examId: string
  visibilityOption: 'hidden' | 'immediate' | 'scheduled' | 'per_question'
  releaseTimestamp?: string
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
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

    if (authError || !user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          details: authError?.message || 'No user found',
        },
        { status: 401 }
      )
    }

    // Check admin role
    let userRole = user.user_metadata?.role || user.app_metadata?.role

    if (user.email === 'admin@admin.sat') {
      userRole = 'admin'
    }

    if (!userRole) {
      // Fallback to user_profiles table
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      userRole = profile?.role
    }

    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body: UpdateVisibilityRequest = await request.json()
    const { examId, visibilityOption, releaseTimestamp } = body

    if (!examId || !visibilityOption) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Construct update object based on visibility option
    let updateData: {
      answers_visible: boolean
      answers_visible_after?: string | null
    } = {
      answers_visible: false,
      answers_visible_after: null,
    }

    switch (visibilityOption) {
      case 'immediate':
        updateData = {
          answers_visible: true,
          answers_visible_after: null,
        }
        break
      case 'scheduled':
        if (!releaseTimestamp) {
          return NextResponse.json(
            { error: 'Release timestamp required for scheduled option' },
            { status: 400 }
          )
        }
        updateData = {
          answers_visible: false,
          answers_visible_after: releaseTimestamp,
        }
        break
      case 'per_question':
        updateData = {
          answers_visible: true,
          answers_visible_after: null,
        }
        break
      case 'hidden':
      default:
        updateData = {
          answers_visible: false,
          answers_visible_after: null,
        }
        break
    }

    // Use service role for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabaseService = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Update exam's answer check mode
    const examUpdateData: { answer_check_mode: string } = {
      answer_check_mode:
        visibilityOption === 'per_question' ? 'per_question' : 'exam_end',
    }

    const { error: examError } = await supabaseService
      .from('exams')
      .update(examUpdateData)
      .eq('id', examId)

    if (examError) {
      console.error('Error updating exam answer check mode:', examError)
      return NextResponse.json(
        { error: 'Failed to update exam settings' },
        { status: 500 }
      )
    }

    // Update all test attempts for this exam
    const { data, error } = await supabaseService
      .from('test_attempts')
      .update(updateData)
      .eq('exam_id', examId)
      .select('id')

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update answer visibility' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Updated answer visibility for ${data?.length || 0} attempts`,
      updatedAttempts: data?.length || 0,
    })
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
