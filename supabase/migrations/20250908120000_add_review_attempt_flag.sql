-- Add review_attempt_taken flag to test_attempts table
-- This tracks whether the one-time "Second Chance" review session has been completed

ALTER TABLE public.test_attempts
ADD COLUMN IF NOT EXISTS review_attempt_taken BOOLEAN NOT NULL DEFAULT false;

-- Add comment to document the purpose of this column
COMMENT ON COLUMN public.test_attempts.review_attempt_taken IS 'True if the one-time "Second Chance" review session has been completed for this attempt.';

-- Create an index for efficient queries on this flag
CREATE INDEX IF NOT EXISTS idx_test_attempts_review_attempt_taken 
ON public.test_attempts (review_attempt_taken) 
WHERE review_attempt_taken = false;