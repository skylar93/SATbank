const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './apps/web/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('Testing Supabase connection...')
console.log('URL:', supabaseUrl)
console.log('Anon key length:', supabaseAnonKey?.length || 'MISSING')
console.log('Service key length:', supabaseServiceKey?.length || 'MISSING')

// Test with anon key (like the frontend)
const anonClient = createClient(supabaseUrl, supabaseAnonKey)

// Test with service key (for admin operations)
const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

async function testConnection() {
  try {
    // Test basic connection
    console.log('\n1. Testing basic anon connection...')
    const { data: authData, error: authError } = await anonClient.auth.getSession()
    console.log('Auth session:', authError || 'OK')

    // Test table access
    console.log('\n2. Testing table access...')
    const { data: profilesData, error: profilesError } = await anonClient
      .from('user_profiles')
      .select('id')
      .limit(1)
    console.log('User profiles access:', profilesError || `Got ${profilesData?.length || 0} rows`)

    // Test mistake_bank access
    console.log('\n3. Testing mistake_bank access...')
    const { data: mistakeData, error: mistakeError } = await anonClient
      .from('mistake_bank')
      .select('id')
      .limit(1)
    console.log('Mistake bank access:', mistakeError || `Got ${mistakeData?.length || 0} rows`)

    // Test exam_questions access
    console.log('\n4. Testing exam_questions access...')
    const { data: examQuestionsData, error: examQuestionsError } = await anonClient
      .from('exam_questions')
      .select('id')
      .limit(1)
    console.log('Exam questions access:', examQuestionsError || `Got ${examQuestionsData?.length || 0} rows`)

    // Test service key connection
    console.log('\n5. Testing service key connection...')
    const { data: serviceData, error: serviceError } = await serviceClient
      .from('user_profiles')
      .select('id')
      .limit(1)
    console.log('Service key access:', serviceError || `Got ${serviceData?.length || 0} rows`)

  } catch (err) {
    console.error('Connection test failed:', err.message)
  }
}

testConnection()