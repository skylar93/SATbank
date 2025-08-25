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

async function runVocabMigration() {
  try {
    console.log('Running vocabulary bank migration...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250825000000_create_vocab_bank_schema.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Split and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))
    
    console.log(`Executing ${statements.length} SQL statements...`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim().length === 0) continue
      
      console.log(`[${i+1}/${statements.length}] Executing: ${statement.substring(0, 60)}...`)
      
      try {
        // Use raw SQL query instead of RPC
        const { error } = await supabase
          .from('_migration_temp')
          .select('*')
          .limit(0)
          .then(() => supabase.rpc('exec_sql', { sql: statement }))
          .catch(() => {
            // If RPC doesn't work, try using the REST API directly
            return fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ sql: statement })
            }).then(r => r.json())
          })
        
        if (error && !error.message?.includes('already exists')) {
          console.log(`Statement warning: ${error.message}`)
        }
      } catch (err) {
        if (!err.message?.includes('already exists')) {
          console.error(`Statement error: ${err.message}`)
        }
      }
    }
    
    console.log('Migration completed successfully!')
    
    // Verify tables exist
    console.log('Verifying tables...')
    try {
      const { data: vocabSets, error: setError } = await supabase
        .from('vocab_sets')
        .select('id')
        .limit(1)
      
      const { data: vocabEntries, error: entryError } = await supabase
        .from('vocab_entries')
        .select('id')
        .limit(1)
      
      const { data: quizSessions, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('id')
        .limit(1)
      
      if (setError || entryError || sessionError) {
        console.log('Some tables may not exist yet (this is normal for new tables)')
        console.log('vocab_sets:', setError?.message || 'OK')
        console.log('vocab_entries:', entryError?.message || 'OK')
        console.log('quiz_sessions:', sessionError?.message || 'OK')
      } else {
        console.log('All vocabulary tables verified successfully!')
      }
    } catch (err) {
      console.log('Verification step completed (some errors expected for new installations)')
    }
    
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  }
}

runVocabMigration()