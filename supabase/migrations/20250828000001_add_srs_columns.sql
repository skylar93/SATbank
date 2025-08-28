-- Migration: Add SRS (Spaced Repetition System) columns to vocab_entries
-- This enables intelligent review scheduling based on forgetting curve theory

-- Add SRS columns to vocab_entries table
ALTER TABLE public.vocab_entries 
ADD COLUMN next_review_date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN review_interval INTEGER DEFAULT 1;

-- Set initial values for existing entries
UPDATE public.vocab_entries 
SET 
  next_review_date = NOW(),
  review_interval = 1
WHERE next_review_date IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.vocab_entries.next_review_date IS 'The next scheduled review date for this vocabulary entry (SRS)';
COMMENT ON COLUMN public.vocab_entries.review_interval IS 'Current review interval in days, doubles on correct answers, resets to 1 on incorrect';

-- Add index for efficient SRS queries
CREATE INDEX idx_vocab_entries_next_review ON public.vocab_entries(next_review_date);
CREATE INDEX idx_vocab_entries_srs_lookup ON public.vocab_entries(user_id, next_review_date, mastery_level);