// Simple script to add the missing column
const { createClient } = require('@supabase/supabase-js')

// Load environment variables - adjust path if needed
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zwucgfewwrqkltbmisje.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY environment variable')
  console.log('You can find this key in your Supabase dashboard under Settings > API')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addColumn() {
  try {
    console.log('Adding show_correct_answers column to user_profiles table...')
    
    // Try to add the column
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_profiles' 
            AND column_name = 'show_correct_answers'
          ) THEN
            ALTER TABLE user_profiles ADD COLUMN show_correct_answers BOOLEAN DEFAULT FALSE;
            UPDATE user_profiles SET show_correct_answers = FALSE WHERE show_correct_answers IS NULL;
            RAISE NOTICE 'Column show_correct_answers added successfully';
          ELSE
            RAISE NOTICE 'Column show_correct_answers already exists';
          END IF;
        END
        $$;
      `
    })
    
    if (error) {
      console.error('Error adding column:', error.message)
      // Try alternative approach
      console.log('Trying alternative approach...')
      
      const { error: altError } = await supabase
        .from('user_profiles')
        .select('show_correct_answers')
        .limit(1)
        
      if (altError && altError.message.includes('does not exist')) {
        console.log('Column definitely does not exist. Manual intervention needed.')
        console.log('Please run this SQL in your Supabase SQL editor:')
        console.log('ALTER TABLE user_profiles ADD COLUMN show_correct_answers BOOLEAN DEFAULT FALSE;')
        console.log('UPDATE user_profiles SET show_correct_answers = FALSE WHERE show_correct_answers IS NULL;')
      } else {
        console.log('Column might already exist or there\'s another issue')
      }
    } else {
      console.log('Column addition completed!')
    }
    
  } catch (err) {
    console.error('Script failed:', err.message)
  }
}

addColumn()