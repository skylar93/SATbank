// Debug script to test authentication and profile access
import { supabase } from './lib/supabase'

async function debugAuth() {
  console.log('🔍 Starting authentication debug...')

  // Use the centralized Supabase client

  try {
    // Check current session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    console.log('📋 Session check:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      accessToken: session?.access_token ? 'present' : 'missing',
      refreshToken: session?.refresh_token ? 'present' : 'missing',
      expiresAt: session?.expires_at,
      currentTime: new Date().toISOString(),
      error: sessionError,
    })

    if (!session) {
      console.log('❌ No active session found. Please login first.')
      return
    }

    // Try to fetch user profile
    console.log('🔍 Fetching user profile...')
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    console.log('👤 Profile result:', {
      profile,
      hasProfile: !!profile,
      profileRole: profile?.role,
      error: profileError
        ? {
            message: profileError.message,
            code: profileError.code,
            details: profileError.details,
            hint: profileError.hint,
          }
        : null,
    })

    // Try to fetch questions (this is what's failing)
    console.log('🔍 Testing questions access...')
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id, question_number, module_type, exam_id')
      .limit(5)

    console.log('📝 Questions result:', {
      questionsCount: questions?.length || 0,
      sampleQuestions: questions?.slice(0, 2),
      error: questionsError
        ? {
            message: questionsError.message,
            code: questionsError.code,
            details: questionsError.details,
            hint: questionsError.hint,
          }
        : null,
    })

    // Check RLS function
    console.log('🔍 Testing RLS helper function...')
    const { data: isAdminResult, error: rpcError } = await supabase.rpc(
      'is_admin',
      { user_id: session.user.id }
    )

    console.log('🔐 RLS Admin check result:', {
      isAdmin: isAdminResult,
      error: rpcError
        ? {
            message: rpcError.message,
            code: rpcError.code,
            details: rpcError.details,
            hint: rpcError.hint,
          }
        : null,
    })

    // Test verification function from the fix script
    console.log('🔍 Testing verification function...')
    const { data: verifyResult, error: verifyError } = await supabase.rpc(
      'verify_questions_access'
    )

    console.log('✅ Verification result:', {
      result: verifyResult,
      error: verifyError
        ? {
            message: verifyError.message,
            code: verifyError.code,
            details: verifyError.details,
            hint: verifyError.hint,
          }
        : null,
    })
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Export for browser console usage
;(window as any).debugAuth = debugAuth

console.log(
  '🚀 Debug function loaded. Run debugAuth() in the browser console to test.'
)
