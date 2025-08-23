-- Add per-question answer checking functionality
-- This allows students to see correct answers immediately after answering each question

-- Add answer checking mode to exams table
ALTER TABLE public.exams 
ADD COLUMN answer_check_mode text DEFAULT 'exam_end' 
CHECK (answer_check_mode IN ('exam_end', 'per_question'));

-- Add comment for clarity
COMMENT ON COLUMN public.exams.answer_check_mode IS 'Controls when students can see correct answers: exam_end (after completing entire exam) or per_question (immediately after each question)';

-- Add column to track when user viewed the correct answer for each question
ALTER TABLE public.user_answers 
ADD COLUMN viewed_correct_answer_at timestamptz;

-- Add comment for clarity
COMMENT ON COLUMN public.user_answers.viewed_correct_answer_at IS 'Timestamp when the student viewed the correct answer for this question (for per_question mode)';

-- Create index for efficient querying of answer viewing times
CREATE INDEX idx_user_answers_viewed_at ON public.user_answers(viewed_correct_answer_at);

-- Update the updated_at trigger to handle the new column
-- (The existing trigger should automatically handle this, but adding comment for clarity)
COMMENT ON TABLE public.user_answers IS 'Stores individual question answers from students, now with support for tracking when correct answers are viewed';