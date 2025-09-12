-- Migration File: 20250822120000_add_answer_visibility_to_attempts.sql
-- Purpose: Add per-attempt answer visibility controls for more flexible answer disclosure management

-- 1. Add answer visibility columns to test_attempts table
ALTER TABLE public.test_attempts
ADD COLUMN IF NOT EXISTS answers_visible BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS answers_visible_after TIMESTAMPTZ;

-- 2. Add comments for documentation
COMMENT ON COLUMN public.test_attempts.answers_visible IS 'Controls if answers are visible for this specific attempt. Takes precedence over user profile setting.';
COMMENT ON COLUMN public.test_attempts.answers_visible_after IS 'If set, answers become visible only after this timestamp. Useful for timed releases.';

-- 3. Create index for performance on answer visibility queries
CREATE INDEX IF NOT EXISTS idx_test_attempts_answers_visible ON public.test_attempts(answers_visible);
CREATE INDEX IF NOT EXISTS idx_test_attempts_answers_visible_after ON public.test_attempts(answers_visible_after);

-- 4. Update existing test_attempts to inherit visibility from user profiles
-- This ensures backwards compatibility with existing data
UPDATE public.test_attempts 
SET answers_visible = (
    SELECT COALESCE(up.show_correct_answers, false) 
    FROM public.user_profiles up 
    WHERE up.id = test_attempts.user_id
)
WHERE answers_visible = false;

-- 5. Add helpful function to check if answers should be visible
CREATE OR REPLACE FUNCTION public.should_show_answers(attempt_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    attempt_record RECORD;
BEGIN
    -- Get attempt data
    SELECT 
        ta.answers_visible,
        ta.answers_visible_after,
        up.show_correct_answers
    INTO attempt_record
    FROM public.test_attempts ta
    JOIN public.user_profiles up ON up.id = ta.user_id
    WHERE ta.id = attempt_id;
    
    -- If no record found, return false
    IF attempt_record IS NULL THEN
        RETURN false;
    END IF;
    
    -- If answers are explicitly set to visible for this attempt
    IF attempt_record.answers_visible = true THEN
        -- Check if there's a time restriction
        IF attempt_record.answers_visible_after IS NOT NULL THEN
            RETURN now() >= attempt_record.answers_visible_after;
        ELSE
            RETURN true;
        END IF;
    END IF;
    
    -- Fall back to user profile setting for backwards compatibility
    RETURN COALESCE(attempt_record.show_correct_answers, false);
END;
$$;

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.should_show_answers TO authenticated;

-- 7. Add comment for the function
COMMENT ON FUNCTION public.should_show_answers IS 'Determines if answers should be visible for a given attempt, considering both attempt-level and user-level settings.';