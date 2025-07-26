// Debug script to test authentication and profile access
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.log('Please check your .env.local file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugAuth() {
  console.log('🔍 Starting authentication debug...')
  
  try {
    // Check current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('📋 Session check:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      error: sessionError
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
    })
    
    // Try to fetch questions (this is what's failing)
    console.log('🔍 Testing questions access...')
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id, question_number, module_type')
      .limit(5)
    
    console.log('📝 Questions result:', {
      questionsCount: questions?.length || 0,
      sampleQuestions: questions?.slice(0, 2),
      error: questionsError
    })
    
    // Check user profile permissions
    console.log('🔍 Testing user profiles access...')
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, email, role')
      .limit(3)
    
    console.log('👥 User profiles result:', {
      profilesCount: profiles?.length || 0,
      sampleProfiles: profiles?.slice(0, 2),
      error: profilesError
    })
    
  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

debugAuth()