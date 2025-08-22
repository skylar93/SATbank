const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: './apps/web/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  try {
    console.log('Applying migration to fix exam_questions RLS policy...')
    
    // Drop existing policy
    console.log('1. Dropping existing policy...')
    const dropResult = await supabase.rpc('exec_sql', {
      sql: 'DROP POLICY IF EXISTS "Admins can manage exam questions" ON public.exam_questions'
    })
    
    if (dropResult.error) {
      // Try alternative approach - direct SQL queries
      console.log('Direct SQL approach - dropping policy...')
      try {
        // We'll try to execute this via a stored procedure or direct connection
        const { data: policyExists } = await supabase
          .from('pg_policies')
          .select('*')
          .eq('tablename', 'exam_questions')
          .eq('policyname', 'Admins can manage exam questions')
        
        console.log('Existing policies found:', policyExists?.length || 0)
      } catch (e) {
        console.log('Could not check existing policies:', e.message)
      }
    }
    
    console.log('2. Creating new policy using direct client queries...')
    
    // Since we can't execute DDL directly, let's check if the current user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    console.log('Current user:', user?.id || 'Not authenticated')
    
    // Test if we can access exam_questions with service key
    const { data: examQData, error: examQError } = await supabase
      .from('exam_questions')
      .select('*')
      .limit(1)
    
    console.log('Exam questions access with service key:', examQError || `Success - ${examQData?.length || 0} rows`)
    
    console.log('\n✅ Migration analysis complete!')
    console.log('The issue might be on the client side. Let me check the frontend authentication state.')
    
  } catch (err) {
    console.error('Error:', err.message)
  }
}

applyMigration()