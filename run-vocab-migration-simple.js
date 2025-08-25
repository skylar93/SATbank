const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './apps/web/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function createVocabTables() {
  console.log('Creating vocabulary tables...')
  
  try {
    // Create vocab_sets table
    console.log('Creating vocab_sets table...')
    const { error: vocabSetsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.vocab_sets (
            id BIGSERIAL PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        
        ALTER TABLE public.vocab_sets ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can view their own vocab sets" ON public.vocab_sets;
        DROP POLICY IF EXISTS "Users can create their own vocab sets" ON public.vocab_sets;
        DROP POLICY IF EXISTS "Users can update their own vocab sets" ON public.vocab_sets;
        DROP POLICY IF EXISTS "Users can delete their own vocab sets" ON public.vocab_sets;
        
        CREATE POLICY "Users can view their own vocab sets" ON public.vocab_sets
            FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can create their own vocab sets" ON public.vocab_sets
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can update their own vocab sets" ON public.vocab_sets
            FOR UPDATE USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can delete their own vocab sets" ON public.vocab_sets
            FOR DELETE USING (auth.uid() = user_id);
        
        CREATE INDEX IF NOT EXISTS idx_vocab_sets_user_id ON public.vocab_sets(user_id);
      `
    })
    
    if (vocabSetsError) {
      console.error('Error creating vocab_sets:', vocabSetsError)
    } else {
      console.log('vocab_sets table created successfully')
    }
    
    // Create vocab_entries table
    console.log('Creating vocab_entries table...')
    const { error: vocabEntriesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.vocab_entries (
            id BIGSERIAL PRIMARY KEY,
            set_id BIGINT NOT NULL REFERENCES public.vocab_sets(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            term TEXT NOT NULL,
            definition TEXT NOT NULL,
            example_sentence TEXT,
            mastery_level INT NOT NULL DEFAULT 0,
            last_reviewed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        
        ALTER TABLE public.vocab_entries ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can view their own vocab entries" ON public.vocab_entries;
        DROP POLICY IF EXISTS "Users can create their own vocab entries" ON public.vocab_entries;
        DROP POLICY IF EXISTS "Users can update their own vocab entries" ON public.vocab_entries;
        DROP POLICY IF EXISTS "Users can delete their own vocab entries" ON public.vocab_entries;
        
        CREATE POLICY "Users can view their own vocab entries" ON public.vocab_entries
            FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can create their own vocab entries" ON public.vocab_entries
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can update their own vocab entries" ON public.vocab_entries
            FOR UPDATE USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can delete their own vocab entries" ON public.vocab_entries
            FOR DELETE USING (auth.uid() = user_id);
        
        CREATE INDEX IF NOT EXISTS idx_vocab_entries_set_id ON public.vocab_entries(set_id);
        CREATE INDEX IF NOT EXISTS idx_vocab_entries_user_id ON public.vocab_entries(user_id);
      `
    })
    
    if (vocabEntriesError) {
      console.error('Error creating vocab_entries:', vocabEntriesError)
    } else {
      console.log('vocab_entries table created successfully')
    }
    
    // Create quiz_sessions table  
    console.log('Creating quiz_sessions table...')
    const { error: quizSessionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.quiz_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            set_id BIGINT NOT NULL REFERENCES public.vocab_sets(id) ON DELETE CASCADE,
            quiz_type TEXT NOT NULL,
            quiz_format TEXT NOT NULL,
            score_percentage FLOAT,
            questions_total INT NOT NULL DEFAULT 0,
            questions_correct INT NOT NULL DEFAULT 0,
            completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        
        ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can view their own quiz sessions" ON public.quiz_sessions;
        DROP POLICY IF EXISTS "Users can create their own quiz sessions" ON public.quiz_sessions;
        DROP POLICY IF EXISTS "Users can update their own quiz sessions" ON public.quiz_sessions;
        
        CREATE POLICY "Users can view their own quiz sessions" ON public.quiz_sessions
            FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can create their own quiz sessions" ON public.quiz_sessions
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can update their own quiz sessions" ON public.quiz_sessions
            FOR UPDATE USING (auth.uid() = user_id);
        
        CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_id ON public.quiz_sessions(user_id);
      `
    })
    
    if (quizSessionsError) {
      console.error('Error creating quiz_sessions:', quizSessionsError)
    } else {
      console.log('quiz_sessions table created successfully')
    }
    
    console.log('All vocabulary tables created successfully!')
    
    // Test the tables
    console.log('Testing table access...')
    const { data: sets, error: setTestError } = await supabase
      .from('vocab_sets')
      .select('id')
      .limit(1)
    
    if (!setTestError) {
      console.log('✓ vocab_sets table accessible')
    }
    
    const { data: entries, error: entryTestError } = await supabase
      .from('vocab_entries')  
      .select('id')
      .limit(1)
    
    if (!entryTestError) {
      console.log('✓ vocab_entries table accessible')
    }
    
    const { data: sessions, error: sessionTestError } = await supabase
      .from('quiz_sessions')
      .select('id')
      .limit(1)
    
    if (!sessionTestError) {
      console.log('✓ quiz_sessions table accessible')
    }
    
  } catch (error) {
    console.error('Migration failed:', error.message)
  }
}

createVocabTables()