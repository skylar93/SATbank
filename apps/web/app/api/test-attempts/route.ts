import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('🔥 API ROUTE: test-attempts POST started')
  
  try {
    const supabase = await createClient()
    console.log('🔥 API: Supabase client created')

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (!user || userError) {
      console.log('🚨 API: Authentication failed - no user found')
      return NextResponse.json({ 
        error: 'Unauthorized - Authentication failed',
        details: 'Unable to authenticate user. Please refresh the page and try again.'
      }, { status: 401 })
    }
    
    console.log('✅ API: User authenticated successfully:', user.email)

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
          console.log('API: Admin', user.email, 'creating test attempt for impersonated user:', targetUserId)
        }
      } catch (error) {
        console.error('Failed to parse impersonation data:', error)
        return NextResponse.json({ error: 'Invalid impersonation data' }, { status: 400 })
      }
    }

    console.log('🔄 API: Attempting to insert test attempt for user:', targetUserId)
    
    const { data, error } = await supabase
      .from('test_attempts')
      .insert({
        ...body,
        user_id: targetUserId,
      })
      .select()
      .single()
      
    console.log('🔄 API: Database insertion result:', { 
      success: !!data, 
      error: error?.message,
      insertedId: data?.id 
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('🚨 API: Unexpected error in test-attempts POST:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 })
  }
}
