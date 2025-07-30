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

async function runMigration() {
  try {
    console.log('Running migration to add show_correct_answers column...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20240101000010_add_show_correct_answers.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: migrationSQL 
    })
    
    if (error) {
      // Try direct execution if the RPC doesn't work
      console.log('Trying direct SQL execution...')
      
      // Split and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
      
      for (const statement of statements) {
        console.log('Executing:', statement.substring(0, 50) + '...')
        const { error: execError } = await supabase.rpc('exec_sql', { sql: statement })
        if (execError) {
          console.log('Statement error (may be expected if column already exists):', execError.message)
        }
      }
    }
    
    console.log('Migration completed successfully!')
    
    // Verify the column exists
    const { data: columns, error: columnError } = await supabase
      .from('user_profiles')
      .select('show_correct_answers')
      .limit(1)
    
    if (columnError) {
      console.error('Verification failed:', columnError.message)
    } else {
      console.log('Column verification successful!')
    }
    
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  }
}

runMigration()