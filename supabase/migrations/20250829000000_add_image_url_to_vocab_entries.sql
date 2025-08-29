-- Add image_url column to vocab_entries table
ALTER TABLE public.vocab_entries
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN public.vocab_entries.image_url IS 'URL for an image associated with the vocabulary term from Supabase Storage';