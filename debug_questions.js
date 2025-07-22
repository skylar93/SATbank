const { createClient } = require('@supabase/supabase-js')

// Use environment variables from .env.local
const supabaseUrl = 'https://eoyzqdsxlweygsukjnef.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveXpxZHN4bHdleWdzdWtqbmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyODQyODEsImV4cCI6MjA2Nzg2MDI4MX0.1KbMpL3cFkrkWVpHZX-1bXiPEgTo-dZx_j7U3zcHGT4'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugQuestions() {
  console.log('🔍 Testing Supabase connection...')
  
  try {
    // Test basic connection
    const { data: authData, error: authError } = await supabase.auth.getUser()
    console.log('Auth status:', authData?.user ? 'Authenticated' : 'Not authenticated')
    console.log('Auth error:', authError)
    
    // Test questions query without auth
    console.log('\n📊 Testing questions query...')
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('id, module_type, question_number, question_text')
      .limit(5)
    
    console.log('Questions count:', questionsData?.length || 0)
    console.log('Questions error:', questionsError)
    console.log('Sample questions:', questionsData?.slice(0, 2))
    
    // Test with count
    const { count, error: countError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
    
    console.log('\n📈 Total questions count:', count)
    console.log('Count error:', countError)
    
  } catch (error) {
    console.error('❌ Debug failed:', error)
  }
}

debugQuestions()