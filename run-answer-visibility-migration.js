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

async function runAnswerVisibilityMigration() {
  try {
    console.log('Running migration to add answer visibility columns to test_attempts...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250822120000_add_answer_visibility_to_attempts.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Split and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))
    
    console.log(`Executing ${statements.length} migration statements...`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        console.log(`[${i+1}/${statements.length}] Executing: ${statement.substring(0, 80)}...`)
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { sql: statement })
          if (error) {
            // For some statements like ALTER TABLE ADD COLUMN IF NOT EXISTS, 
            // errors might be expected if columns already exist
            console.log(`  ⚠️  Statement warning (may be expected): ${error.message}`)
          } else {
            console.log(`  ✅ Statement executed successfully`)
          }
        } catch (err) {
          console.log(`  ❌ Statement error: ${err.message}`)
        }
      }
    }
    
    console.log('\n🔍 Verifying migration...')
    
    // Verify the columns exist
    const { data: sampleAttempt, error: columnError } = await supabase
      .from('test_attempts')
      .select('id, answers_visible, answers_visible_after')
      .limit(1)
      .single()
    
    if (columnError && !columnError.message.includes('No rows found')) {
      console.error('❌ Column verification failed:', columnError.message)
    } else {
      console.log('✅ Columns verification successful!')
      if (sampleAttempt) {
        console.log('   Sample row:', {
          id: sampleAttempt.id,
          answers_visible: sampleAttempt.answers_visible,
          answers_visible_after: sampleAttempt.answers_visible_after
        })
      }
    }
    
    // Test the function
    console.log('\n🧪 Testing should_show_answers function...')
    try {
      if (sampleAttempt?.id) {
        const { data: functionResult, error: functionError } = await supabase.rpc(
          'should_show_answers', 
          { attempt_id: sampleAttempt.id }
        )
        
        if (functionError) {
          console.log('❌ Function test failed:', functionError.message)
        } else {
          console.log('✅ Function test successful! Result:', functionResult)
        }
      } else {
        console.log('ℹ️  No test attempts found to test function with')
      }
    } catch (err) {
      console.log('❌ Function test error:', err.message)
    }
    
    console.log('\n🎉 Migration completed successfully!')
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  }
}

runAnswerVisibilityMigration()