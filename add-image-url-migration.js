const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './apps/web/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function addImageUrlColumn() {
  console.log('Adding image_url column to vocab_entries...')
  
  try {
    // Try to add the column using a direct query approach
    const { data, error } = await supabase
      .from('vocab_entries')
      .select('image_url')
      .limit(1)
    
    if (error && error.code === 'PGRST116') {
      // Column doesn't exist, which means we need to add it
      console.log('Column does not exist, attempting to use SQL editor...')
      console.log('Please run this SQL manually in Supabase SQL editor:')
      console.log(`
ALTER TABLE public.vocab_entries
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.vocab_entries.image_url IS 'URL for an image associated with the vocabulary term from Supabase Storage';
      `)
    } else if (!error) {
      console.log('✓ image_url column already exists and is accessible')
    } else {
      console.error('Unexpected error:', error)
    }
    
  } catch (error) {
    console.error('Migration failed:', error.message)
  }
}

addImageUrlColumn()