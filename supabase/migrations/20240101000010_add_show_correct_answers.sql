-- Add show_correct_answers field to user_profiles table
-- This allows admins to control whether students can see correct answers after completing exams

ALTER TABLE user_profiles 
ADD COLUMN show_correct_answers BOOLEAN DEFAULT FALSE;

-- Add comment to explain the field
COMMENT ON COLUMN user_profiles.show_correct_answers IS 'Controls whether the student can see correct answers after completing an exam. Only admins can modify this setting.';

-- Update existing users to have show_correct_answers = false by default
UPDATE user_profiles SET show_correct_answers = FALSE WHERE show_correct_answers IS NULL;