-- Fix for missing show_correct_answers column
-- Run this in your Supabase SQL Editor

-- Check if column exists and add it if it doesn't
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'show_correct_answers'
  ) THEN
    -- Add the column
    ALTER TABLE user_profiles ADD COLUMN show_correct_answers BOOLEAN DEFAULT FALSE;
    
    -- Update existing records
    UPDATE user_profiles SET show_correct_answers = FALSE WHERE show_correct_answers IS NULL;
    
    -- Add comment for documentation
    COMMENT ON COLUMN user_profiles.show_correct_answers IS 'Controls whether the student can see correct answers after completing an exam. Only admins can modify this setting.';
    
    RAISE NOTICE 'Column show_correct_answers added successfully';
  ELSE
    RAISE NOTICE 'Column show_correct_answers already exists';
  END IF;
END
$$;