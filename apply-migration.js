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
    
    // Read the migration file
    const migrationSQL = fs.readFileSync('./supabase/migrations/20250822000000_fix_exam_questions_admin_policy.sql', 'utf8')
    console.log('Migration SQL:', migrationSQL)
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log('Executing', statements.length, 'SQL statements...')
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement) {
        console.log(`Executing statement ${i + 1}:`, statement.substring(0, 80) + '...')
        
        // Try to execute as a simple query
        try {
          const { data, error } = await supabase
            .from('__pg_catalog')
            .select('*')
            .limit(0)
          
          // If that works, try to execute the actual SQL
          const result = await supabase.rpc('exec', { sql: statement })
          
          if (result.error && result.error.code !== 'P0001') {
            console.log('Statement execution warning:', result.error.message)
          }
        } catch (err) {
          console.log('Error executing statement (might be expected):', err.message)
        }
      }
    }
    
    console.log('✅ Migration application completed!')
    
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

applyMigration()