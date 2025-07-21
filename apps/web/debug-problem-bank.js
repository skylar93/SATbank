// Debug the specific problem bank query that's failing
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://eoyzqdsxlweygsukjnef.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveXpxZHN4bHdleWdzdWtqbmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyODQyODEsImV4cCI6MjA2Nzg2MDI4MX0.1KbMpL3cFkrkWVpHZX-1bXiPEgTo-dZx_j7U3zcHGT4'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugProblemBank() {
  console.log('🔍 Debugging Problem Bank Query...')
  
  try {
    // Simulate the exact query from the problem bank page (line 82-86)
    console.log('\n1. Testing exact query from problem bank page...')
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .order('module_type')
      .order('question_number')

    if (questionsError) {
      console.log('❌ Questions query error:', questionsError)
      console.log('Error details:', JSON.stringify(questionsError, null, 2))
    } else {
      console.log('✅ Questions query successful:', questionsData?.length || 0, 'questions found')
      if (questionsData && questionsData.length > 0) {
        console.log('First question:', {
          id: questionsData[0].id,
          module_type: questionsData[0].module_type,
          question_text: questionsData[0].question_text.substring(0, 100) + '...'
        })
      }
    }

    // Test the user answers query too (line 104-114)
    console.log('\n2. Testing user answers query...')
    
    // We need a fake user ID for this test
    const fakeUserId = '00000000-0000-0000-0000-000000000000'
    
    const { data: incorrectAnswers, error: answersError } = await supabase
      .from('user_answers')
      .select(`
        question_id,
        is_correct,
        test_attempts!inner (
          user_id
        )
      `)
      .eq('test_attempts.user_id', fakeUserId)
      .eq('is_correct', false)

    if (answersError) {
      console.log('❌ User answers query error:', answersError)
    } else {
      console.log('✅ User answers query successful (empty result expected):', incorrectAnswers?.length || 0, 'incorrect answers found')
    }

    // Test authentication check
    console.log('\n3. Testing authentication...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.log('❌ Auth error:', authError)
    } else {
      console.log('Auth status:', user ? `Authenticated as ${user.email}` : 'Not authenticated')
    }

  } catch (error) {
    console.error('💥 Debug failed:', error)
  }
}

debugProblemBank()