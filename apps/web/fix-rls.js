// Quick script to apply the RLS fix directly to Supabase
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://eoyzqdsxlweygsukjnef.supabase.co'
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveXpxZHN4bHdleWdzdWtqbmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI4NDI4MSwiZXhwIjoyMDY3ODYwMjgxfQ.A_K81bklI-TkCrhWzElzDH86wrIveEQ1-hzDwM8ByNQ'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixRLS() {
  console.log('🔧 Applying RLS fix for questions table...')

  try {
    // Drop the restrictive policy
    const { error: dropError } = await supabase.rpc('sql', {
      query:
        'DROP POLICY IF EXISTS "Users can view questions for active exams" ON questions;',
    })

    if (dropError) {
      console.log(
        'Note: Could not drop old policy (may not exist):',
        dropError.message
      )
    }

    // Create the new permissive policy
    const { error: createError } = await supabase.rpc('sql', {
      query: `
        CREATE POLICY "Authenticated users can view all questions" ON questions
            FOR SELECT USING (auth.uid() IS NOT NULL);
      `,
    })

    if (createError) {
      console.error('❌ Error creating new policy:', createError)
      return
    }

    // Make exam_id nullable
    const { error: alterError } = await supabase.rpc('sql', {
      query: 'ALTER TABLE questions ALTER COLUMN exam_id DROP NOT NULL;',
    })

    if (alterError) {
      console.log(
        'Note: Could not alter exam_id column (may already be nullable):',
        alterError.message
      )
    }

    console.log('✅ RLS fix applied successfully!')
    console.log('Students should now be able to access the problem bank.')
  } catch (error) {
    console.error('❌ Error applying fix:', error)
  }
}

fixRLS()
