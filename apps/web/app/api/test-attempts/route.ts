import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('🔥 API ROUTE: test-attempts POST started')

  try {
    // Check for Authorization header as alternative to cookies
    const authHeader = request.headers.get('authorization')
    console.log(
      '🔑 API: Authorization header:',
      authHeader ? 'present' : 'missing'
    )

    // Create Supabase client
    const supabase = createClient()

    console.log('🔥 API: Supabase client created')

    // Enhanced authentication check with session fallback
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    console.log('🔥 API: Session check result:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userEmail: session?.user?.email,
      sessionError: sessionError?.message,
      accessToken: session?.access_token ? 'present' : 'missing',
    })

    // If session method fails, try getUser as fallback
    let user = session?.user
    if (!user || sessionError) {
      console.log('🔄 API: Session method failed, trying getUser as fallback')
      const {
        data: { user: fallbackUser },
        error: userError,
      } = await supabase.auth.getUser()

      console.log('🔄 API: Fallback getUser result:', {
        hasUser: !!fallbackUser,
        userEmail: fallbackUser?.email,
        userError: userError?.message,
      })

      if (fallbackUser && !userError) {
        user = fallbackUser
      }
    }

    // If both methods fail but we have Authorization header, try token-based auth
    if (!user && authHeader) {
      console.log(
        '🔑 API: Trying token-based authentication from Authorization header'
      )
      try {
        const token = authHeader.replace('Bearer ', '')
        const {
          data: { user: tokenUser },
          error: tokenError,
        } = await supabase.auth.getUser(token)

        console.log('🔑 API: Token auth result:', {
          hasUser: !!tokenUser,
          userEmail: tokenUser?.email,
          tokenError: tokenError?.message,
        })

        if (tokenUser && !tokenError) {
          user = tokenUser
        }
      } catch (tokenAuthError: any) {
        console.log('🔑 API: Token auth failed:', tokenAuthError.message)
      }
    }

    if (!user) {
      console.log(
        '🚨 API: Authentication failed - no user found through session or getUser methods'
      )
      return NextResponse.json(
        {
          error: 'Unauthorized - Authentication failed',
          details:
            'Unable to authenticate user. Please refresh the page and try again.',
        },
        { status: 401 }
      )
    }

    console.log('✅ API: User authenticated successfully:', user.email)

    // Create authenticated Supabase client for database operations
    let authenticatedSupabase = supabase

    // If we used token-based auth, create a new client with that token
    if (authHeader && (!session || sessionError)) {
      console.log(
        '🔄 API: Creating token-authenticated Supabase client for database operations'
      )
      const token = authHeader.replace('Bearer ', '')

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

      authenticatedSupabase = createSupabaseClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          auth: {
            persistSession: false,
          },
        }
      )

      console.log('✅ API: Token-authenticated Supabase client created')
    }

    // Parse request body with error handling
    let body
    try {
      const requestText = await request.text()
      if (!requestText.trim()) {
        throw new Error('Empty request body')
      }
      body = JSON.parse(requestText)
    } catch (parseError: any) {
      console.error('🚨 API: Failed to parse request body:', {
        error: parseError.message,
        requestMethod: request.method,
        contentType: request.headers.get('content-type'),
      })
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    // Check for impersonation data in request headers
    const impersonationHeader = request.headers.get('x-impersonation-data')
    let targetUserId = user.id

    if (impersonationHeader) {
      try {
        const impersonationData = JSON.parse(impersonationHeader)
        if (impersonationData.target_user && impersonationData.target_user.id) {
          // Verify that the current user is an admin when impersonating
          const { data: userProfile, error: profileError } =
            await authenticatedSupabase
              .from('user_profiles')
              .select('role')
              .eq('id', user.id)
              .single()

          if (profileError || !userProfile || userProfile.role !== 'admin') {
            return NextResponse.json(
              {
                error: 'Unauthorized: Admin access required for impersonation',
              },
              { status: 401 }
            )
          }

          targetUserId = impersonationData.target_user.id
          console.log(
            'API: Admin',
            user.email,
            'creating test attempt for impersonated user:',
            targetUserId
          )
        }
      } catch (error) {
        console.error('Failed to parse impersonation data:', error)
        return NextResponse.json(
          { error: 'Invalid impersonation data' },
          { status: 400 }
        )
      }
    }

    console.log(
      '🔄 API: Attempting to insert test attempt for user:',
      targetUserId
    )

    const { data, error } = await authenticatedSupabase
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
      insertedId: data?.id,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('🚨 API: Unexpected error in test-attempts POST:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
