import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('🔥🔥🔥 API ROUTE HIT: test-attempts POST request 🔥🔥🔥')
  
  const cookieStore = cookies()
  
  // Create Supabase client with explicit cookie handling
  const supabase = createRouteHandlerClient({ 
    cookies: () => cookieStore,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  try {
    // Get session first
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession()
    
    console.log('API: Session check - Session exists:', !!session, 'Error:', sessionError)
    console.log('API: User from session:', session?.user?.email)
    
    // If no session, try to get user directly
    if (!session) {
      console.log('API: No session found, trying direct user lookup...')
      const { data: { user }, error: directUserError } = await supabase.auth.getUser()
      console.log('API: Direct user lookup - User exists:', !!user, 'Error:', directUserError)
    }
    
    // Also try getUser as backup
    if (!session?.user) {
      console.log('API: Trying getUser as backup...')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('API: getUser result - User exists:', !!user, 'Error:', userError)
      
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized - No session or user found' }, { status: 401 })
      }
      
      // Use user from getUser if session is not available
      console.log('API: Using user from getUser:', user.email)
    }
    
    let user = session?.user
    if (!user) {
      const { data: { user: backupUser }, error: backupError } = await supabase.auth.getUser()
      if (backupError) {
        console.log('API: Backup getUser failed:', backupError)
        return NextResponse.json({ error: 'Unauthorized - Authentication failed' }, { status: 401 })
      }
      user = backupUser
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
          console.log('API: Admin', user.email, 'creating test attempt for impersonated user:', targetUserId)
        }
      } catch (error) {
        console.error('Failed to parse impersonation data:', error)
        return NextResponse.json({ error: 'Invalid impersonation data' }, { status: 400 })
      }
    }

    const { data, error } = await supabase
      .from('test_attempts')
      .insert({
        ...body,
        user_id: targetUserId,
      })
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
