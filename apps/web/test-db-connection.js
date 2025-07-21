// Test database connection and questions access
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eoyzqdsxlweygsukjnef.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveXpxZHN4bHdleWdzdWtqbmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyODQyODEsImV4cCI6MjA2Nzg2MDI4MX0.1KbMpL3cFkrkWVpHZX-1bXiPEgTo-dZx_j7U3zcHGT4'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  console.log('🧪 Testing Supabase connection...')
  
  try {
    // Test 1: Basic connection
    const { data: user, error: authError } = await supabase.auth.getUser()
    console.log('Auth status:', authError ? 'Not authenticated' : 'Authenticated')
    
    // Test 2: Try to fetch questions without authentication
    console.log('\n📚 Testing questions access (unauthenticated)...')
    const { data: questionsUnauth, error: errorUnauth } = await supabase
      .from('questions')
      .select('id, question_text, module_type')
      .limit(5)
    
    if (errorUnauth) {
      console.log('❌ Unauthenticated access error:', errorUnauth.message)
    } else {
      console.log('✅ Unauthenticated access successful:', questionsUnauth?.length || 0, 'questions found')
    }
    
    // Test 3: Check if there are questions in the database at all (using service role)
    const supabaseService = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveXpxZHN4bHdleWdzdWtqbmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI4NDI4MSwiZXhwIjoyMDY3ODYwMjgxfQ.A_K81bklI-TkCrhWzElzDH86wrIveEQ1-hzDwM8ByNQ')
    
    console.log('\n🔑 Testing with service role...')
    const { data: questionsService, error: errorService } = await supabaseService
      .from('questions')
      .select('id, question_text, module_type, exam_id')
      .limit(10)
    
    if (errorService) {
      console.log('❌ Service role error:', errorService.message)
    } else {
      console.log('✅ Service role successful:', questionsService?.length || 0, 'questions found')
      if (questionsService && questionsService.length > 0) {
        console.log('Sample question:', questionsService[0])
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error)
  }
}

testConnection()