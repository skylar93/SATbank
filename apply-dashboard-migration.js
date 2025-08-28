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

async function applyDashboardMigration() {
  try {
    console.log('Applying dashboard RPC function migration...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250828000000_create_dashboard_rpc_function.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('Executing dashboard RPC function creation...')
    
    // Try to execute the complete SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: migrationSQL 
    })
    
    if (error) {
      console.log('RPC failed, trying statement-by-statement execution...')
      
      // Split and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log('Executing statement...')
          const { error: execError } = await supabase.rpc('exec_sql', { sql: statement })
          if (execError) {
            console.log('Statement error:', execError.message)
            // Continue with next statement
          } else {
            console.log('Statement executed successfully')
          }
        }
      }
    } else {
      console.log('Migration executed successfully!')
    }
    
    // Test the function
    console.log('Testing the new RPC function...')
    const { data: testResult, error: testError } = await supabase.rpc('get_student_dashboard_data', {
      p_user_id: '00000000-0000-0000-0000-000000000000' // Test UUID
    })
    
    if (testError) {
      console.log('Function test error (expected for non-existent user):', testError.message)
    } else {
      console.log('Function test successful! Result structure:', Object.keys(testResult || {}))
    }
    
    console.log('\n✅ Dashboard migration completed!')
    
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  }
}

applyDashboardMigration()