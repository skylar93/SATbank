-- Migration: Create automatic mistake_bank population trigger
-- This ensures that every incorrect answer is automatically added to mistake_bank
-- regardless of how the answer was submitted (Edge Function, API, etc.)

-- Drop trigger and function if they exist (for re-running migration)
DROP TRIGGER IF EXISTS trigger_add_to_mistake_bank ON user_answers;
DROP FUNCTION IF EXISTS add_to_mistake_bank();

-- Create the trigger function that will automatically populate mistake_bank
CREATE OR REPLACE FUNCTION add_to_mistake_bank()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process incorrect answers
  IF NEW.is_correct = false THEN
    -- Insert into mistake_bank, getting user_id from the test attempt
    INSERT INTO mistake_bank (user_id, question_id, status, first_mistaken_at)
    SELECT 
      ta.user_id, 
      NEW.question_id, 
      'unmastered'::mistake_status, 
      NEW.answered_at
    FROM test_attempts ta
    WHERE ta.id = NEW.attempt_id
    ON CONFLICT (user_id, question_id) 
    DO UPDATE SET
      -- Reactivate the mistake if the student misses it again
      status = 'unmastered'::mistake_status,
      -- Clear any previous mastery review timestamp so it surfaces again
      last_reviewed_at = NULL,
      -- Preserve the earliest mistake timestamp
      first_mistaken_at = LEAST(mistake_bank.first_mistaken_at, EXCLUDED.first_mistaken_at);
    
    -- Log the insertion for debugging purposes
    RAISE LOG 'Added question % for user from attempt % to mistake_bank (triggered by user_answer %)', 
      NEW.question_id, NEW.attempt_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger that fires after INSERT or UPDATE on user_answers
CREATE TRIGGER trigger_add_to_mistake_bank
  AFTER INSERT OR UPDATE OF is_correct ON user_answers
  FOR EACH ROW
  EXECUTE FUNCTION add_to_mistake_bank();

-- Add a comment to document this automation
COMMENT ON FUNCTION add_to_mistake_bank() IS 
'Automatically adds incorrect answers to mistake_bank. Triggered whenever a user_answer is marked as incorrect.';

COMMENT ON TRIGGER trigger_add_to_mistake_bank ON user_answers IS 
'Ensures every incorrect answer is automatically tracked in mistake_bank for the Mistakes Practice feature.';
