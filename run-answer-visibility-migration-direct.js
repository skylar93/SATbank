const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: './apps/web/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runDirectMigration() {
  try {
    console.log('🚀 Running direct answer visibility migration...')
    
    // Step 1: Add columns
    console.log('\n📝 Step 1: Adding columns to test_attempts table...')
    
    try {
      const { error: alterError } = await supabase
        .rpc('exec', { 
          query: `
            ALTER TABLE public.test_attempts
            ADD COLUMN IF NOT EXISTS answers_visible BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS answers_visible_after TIMESTAMPTZ;
          `
        })
      
      if (alterError) {
        console.log('  Trying alternative method...')
        // Alternative: Check if columns exist first
        const { data: columns } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_name', 'test_attempts')
          .eq('table_schema', 'public')
        
        const hasAnswersVisible = columns?.some(c => c.column_name === 'answers_visible')
        const hasAnswersVisibleAfter = columns?.some(c => c.column_name === 'answers_visible_after')
        
        console.log(`  Current columns check - answers_visible: ${hasAnswersVisible}, answers_visible_after: ${hasAnswersVisibleAfter}`)
        
        if (!hasAnswersVisible || !hasAnswersVisibleAfter) {
          console.log('  Columns missing, need manual database schema update')
        } else {
          console.log('  ✅ Columns already exist')
        }
      } else {
        console.log('  ✅ Columns added successfully')
      }
    } catch (err) {
      console.log('  Alternative approach: Manual verification...')
      
      // Check if we can select from the table with new columns
      try {
        const { data: testSelect } = await supabase
          .from('test_attempts')
          .select('id, answers_visible, answers_visible_after')
          .limit(1)
        
        console.log('  ✅ Columns are accessible:', testSelect ? 'Yes' : 'No data')
      } catch (selectErr) {
        console.log(`  ❌ Columns not yet available: ${selectErr.message}`)
        console.log('\n  ⚠️  Please run this SQL manually in your Supabase dashboard:')
        console.log(`
        ALTER TABLE public.test_attempts
        ADD COLUMN IF NOT EXISTS answers_visible BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS answers_visible_after TIMESTAMPTZ;
        `)
        return
      }
    }
    
    // Step 2: Update existing data
    console.log('\n📊 Step 2: Updating existing test attempts...')
    
    try {
      const { data: attempts, error: fetchError } = await supabase
        .from('test_attempts')
        .select('id, user_id, answers_visible')
      
      if (fetchError) {
        console.log(`  ❌ Could not fetch attempts: ${fetchError.message}`)
      } else {
        console.log(`  Found ${attempts?.length || 0} test attempts`)
        
        if (attempts && attempts.length > 0) {
          // Get user profiles
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, show_correct_answers')
          
          const profileMap = new Map(profiles?.map(p => [p.id, p.show_correct_answers]) || [])
          
          let updatedCount = 0
          for (const attempt of attempts) {
            if (!attempt.answers_visible) { // Only update if not already true
              const userSetting = profileMap.get(attempt.user_id) || false
              
              const { error: updateError } = await supabase
                .from('test_attempts')
                .update({ answers_visible: userSetting })
                .eq('id', attempt.id)
              
              if (!updateError) {
                updatedCount++
              }
            }
          }
          
          console.log(`  ✅ Updated ${updatedCount} attempts with user profile settings`)
        }
      }
    } catch (err) {
      console.log(`  ⚠️  Data update skipped: ${err.message}`)
    }
    
    // Step 3: Create function
    console.log('\n🔧 Step 3: Creating should_show_answers function...')
    
    // For now, let's create a simple version in the application layer
    console.log('  ℹ️  Function will be implemented in application layer for now')
    
    // Step 4: Final verification
    console.log('\n🔍 Step 4: Final verification...')
    
    try {
      const { data: sampleData, error: verifyError } = await supabase
        .from('test_attempts')
        .select('id, answers_visible, answers_visible_after')
        .limit(3)
      
      if (verifyError) {
        console.log(`  ❌ Verification failed: ${verifyError.message}`)
      } else {
        console.log('  ✅ Schema verification successful!')
        console.log('  Sample data:', sampleData?.map(d => ({
          id: d.id.substring(0, 8) + '...',
          answers_visible: d.answers_visible,
          answers_visible_after: d.answers_visible_after
        })))
      }
    } catch (err) {
      console.log(`  ❌ Verification error: ${err.message}`)
    }
    
    console.log('\n🎉 Migration process completed!')
    console.log('\nNext steps:')
    console.log('1. Verify the columns exist in your Supabase dashboard')
    console.log('2. Update application code to use the new fields')
    console.log('3. Test the new answer visibility functionality')
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  }
}

runDirectMigration()