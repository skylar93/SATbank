-- Migration: Create bulk_update_vocab_progress function for efficient SRS updates
-- This function processes multiple quiz results in a single database call
-- and updates vocab progress using the Spaced Repetition System algorithm

-- Custom type for passing quiz results (create only if not exists)
DO $$ BEGIN
  CREATE TYPE public.quiz_result_input AS (
    entry_id INT,
    was_correct BOOLEAN
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Drop existing function with all possible signatures
DROP FUNCTION IF EXISTS public.bulk_update_vocab_progress(UUID, quiz_result_input[]);
DROP FUNCTION IF EXISTS public.bulk_update_vocab_progress(UUID, quiz_result_input[], INT);
DROP FUNCTION IF EXISTS public.bulk_update_vocab_progress(UUID, quiz_result_input[], INT, INT);
DROP FUNCTION IF EXISTS public.bulk_update_vocab_progress(UUID, quiz_result_input[], INT, INT, FLOAT);
DROP FUNCTION IF EXISTS public.bulk_update_vocab_progress(UUID, quiz_result_input[], INT, INT, FLOAT, INT);
DROP FUNCTION IF EXISTS public.bulk_update_vocab_progress(UUID, quiz_result_input[], INT, INT, FLOAT, INT, INT);
DROP FUNCTION IF EXISTS public.bulk_update_vocab_progress(UUID, quiz_result_input[], INT, INT, FLOAT, INT, INT, INT);

-- Main bulk update function with SRS configuration parameters
CREATE OR REPLACE FUNCTION public.bulk_update_vocab_progress(
  p_user_id UUID,
  results public.quiz_result_input[],
  -- SRS configuration parameters (externalized for flexibility)
  p_mastery_max INT DEFAULT 5,
  p_mastery_min INT DEFAULT 0,
  p_interval_multiplier FLOAT DEFAULT 2.0,
  p_incorrect_reset_interval INT DEFAULT 1,
  p_incorrect_next_review_minutes INT DEFAULT 10,
  p_max_review_interval_days INT DEFAULT 365
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_record public.quiz_result_input;
  current_entry RECORD;
  new_mastery_level INT;
  new_review_interval INT;
  next_review_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Process each quiz result
  FOREACH result_record IN ARRAY results
  LOOP
    -- Get current entry data with row-level security
    SELECT mastery_level, review_interval
    INTO current_entry
    FROM vocab_entries
    WHERE id = result_record.entry_id 
      AND user_id = p_user_id;
    
    -- Skip if entry doesn't exist or doesn't belong to user
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    
    -- Calculate new values based on SRS algorithm
    IF result_record.was_correct THEN
      -- Correct answer: increase mastery level and multiply interval
      new_mastery_level := LEAST(p_mastery_max, current_entry.mastery_level + 1);
      new_review_interval := LEAST(
        p_max_review_interval_days,
        (current_entry.review_interval * p_interval_multiplier)::INT
      );
      next_review_timestamp := NOW() + (new_review_interval || ' days')::INTERVAL;
    ELSE
      -- Incorrect answer: decrease mastery level and reset interval
      new_mastery_level := GREATEST(p_mastery_min, current_entry.mastery_level - 1);
      new_review_interval := p_incorrect_reset_interval;
      -- For incorrect answers, next review is much sooner (within the same session)
      next_review_timestamp := NOW() + (p_incorrect_next_review_minutes || ' minutes')::INTERVAL;
    END IF;
    
    -- Update the entry with new SRS values
    UPDATE vocab_entries
    SET 
      mastery_level = new_mastery_level,
      review_interval = new_review_interval,
      next_review_date = next_review_timestamp,
      last_reviewed_at = NOW()
    WHERE id = result_record.entry_id 
      AND user_id = p_user_id;
  END LOOP;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.bulk_update_vocab_progress TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.bulk_update_vocab_progress IS 
'Bulk update vocabulary progress using Spaced Repetition System algorithm. 
Accepts multiple quiz results and SRS configuration parameters for flexible tuning.';