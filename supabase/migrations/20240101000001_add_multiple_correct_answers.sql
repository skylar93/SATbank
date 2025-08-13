-- Add support for multiple correct answers for grid_in questions
-- This migration adds a new column for storing multiple correct answers
-- while keeping backwards compatibility with existing single answers

-- Add new column for multiple correct answers (only for grid_in questions)
ALTER TABLE questions 
ADD COLUMN correct_answers TEXT[] DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN questions.correct_answers IS 'Array of correct answers for grid_in questions. For multiple_choice questions, use correct_answer field instead.';

-- Create function to migrate existing grid_in questions
CREATE OR REPLACE FUNCTION migrate_grid_in_answers()
RETURNS void AS $$
BEGIN
  -- Update existing grid_in questions to use the new array format
  UPDATE questions 
  SET correct_answers = ARRAY[correct_answer]
  WHERE question_type = 'grid_in' 
  AND correct_answer IS NOT NULL 
  AND correct_answers IS NULL;
  
  RAISE NOTICE 'Migrated % grid_in questions to use correct_answers array', (
    SELECT COUNT(*) FROM questions 
    WHERE question_type = 'grid_in' AND correct_answers IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql;

-- Run the migration
SELECT migrate_grid_in_answers();

-- Add check constraint to ensure grid_in questions use correct_answers
-- and multiple_choice questions use correct_answer
ALTER TABLE questions 
ADD CONSTRAINT questions_correct_answer_format_check 
CHECK (
  (question_type = 'grid_in' AND correct_answers IS NOT NULL) OR
  (question_type = 'multiple_choice' AND correct_answer IS NOT NULL) OR
  (question_type = 'essay')
);

-- Create index for better performance on correct_answers queries
CREATE INDEX idx_questions_correct_answers ON questions USING GIN (correct_answers);