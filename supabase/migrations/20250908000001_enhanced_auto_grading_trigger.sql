-- Enhanced trigger that handles both auto-grading and mistake_bank population
-- This replaces the previous trigger and adds automatic grading functionality

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_add_to_mistake_bank ON user_answers;
DROP FUNCTION IF EXISTS add_to_mistake_bank();

-- Create enhanced function that handles both auto-grading and mistake_bank
CREATE OR REPLACE FUNCTION auto_grade_and_track_mistakes()
RETURNS TRIGGER AS $$
DECLARE
    question_data RECORD;
    user_id_val UUID;
    is_answer_correct BOOLEAN;
BEGIN
    -- Get user_id from test_attempts
    SELECT ta.user_id INTO user_id_val
    FROM test_attempts ta
    WHERE ta.id = NEW.attempt_id;
    
    IF user_id_val IS NULL THEN
        RAISE WARNING 'Could not find user_id for attempt_id: %', NEW.attempt_id;
        RETURN NEW;
    END IF;
    
    -- Get question details for grading
    SELECT * INTO question_data
    FROM questions
    WHERE id = NEW.question_id;
    
    IF question_data IS NULL THEN
        RAISE WARNING 'Could not find question with id: %', NEW.question_id;
        RETURN NEW;
    END IF;
    
    -- Auto-grade if is_correct is null and user_answer is not null
    IF NEW.is_correct IS NULL AND NEW.user_answer IS NOT NULL THEN
        -- Perform automatic grading based on question type
        IF question_data.question_type = 'multiple_choice' THEN
            -- For multiple choice: check if user answer is in correct_answer array
            is_answer_correct := question_data.correct_answer @> jsonb_build_array(NEW.user_answer);
        ELSIF question_data.question_type = 'grid_in' THEN
            -- For grid-in: check both correct_answer and correct_answers arrays
            is_answer_correct := question_data.correct_answer @> jsonb_build_array(NEW.user_answer);
            -- Also check correct_answers if it exists
            IF NOT is_answer_correct AND question_data.correct_answers IS NOT NULL THEN
                is_answer_correct := question_data.correct_answers @> ARRAY[NEW.user_answer];
            END IF;
        ELSE
            -- For other question types, don't auto-grade
            is_answer_correct := NULL;
        END IF;
        
        -- Update the is_correct value
        NEW.is_correct := is_answer_correct;
        
        RAISE LOG 'Auto-graded question % for user %: user_answer=%, correct_answer=%, is_correct=%', 
            NEW.question_id, user_id_val, NEW.user_answer, question_data.correct_answer, is_answer_correct;
    END IF;
    
    -- Add to mistake_bank if answer is incorrect (either originally false or newly graded as false)
    IF NEW.is_correct = false THEN
        INSERT INTO mistake_bank (user_id, question_id, status, first_mistaken_at)
        VALUES (user_id_val, NEW.question_id, 'unmastered'::mistake_status, NEW.answered_at)
        ON CONFLICT (user_id, question_id) 
        DO UPDATE SET
            -- Just touch the record to satisfy the ON CONFLICT requirement
            user_id = EXCLUDED.user_id;
            
        RAISE LOG 'Added question % for user % to mistake_bank', NEW.question_id, user_id_val;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the enhanced trigger that fires before INSERT/UPDATE
CREATE TRIGGER trigger_auto_grade_and_track_mistakes
    BEFORE INSERT OR UPDATE OF is_correct, user_answer ON user_answers
    FOR EACH ROW
    EXECUTE FUNCTION auto_grade_and_track_mistakes();

-- Add comments
COMMENT ON FUNCTION auto_grade_and_track_mistakes() IS 
'Automatically grades answers when is_correct is null, and adds incorrect answers to mistake_bank. Handles both multiple_choice and grid_in question types.';

COMMENT ON TRIGGER trigger_auto_grade_and_track_mistakes ON user_answers IS 
'Ensures every answer is automatically graded and incorrect answers are tracked in mistake_bank.';