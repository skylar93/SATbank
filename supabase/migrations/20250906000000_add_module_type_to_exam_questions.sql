-- Migration to add module_type and question_number columns to exam_questions table
-- This is needed for the new exam creation system that assigns questions by module

-- Add the module_type column
ALTER TABLE public.exam_questions 
ADD COLUMN IF NOT EXISTS module_type TEXT;

-- Add the question_number column 
ALTER TABLE public.exam_questions 
ADD COLUMN IF NOT EXISTS question_number INTEGER;

-- Add check constraint for module_type
ALTER TABLE public.exam_questions 
ADD CONSTRAINT exam_questions_module_type_check 
CHECK (module_type IN ('english1', 'english2', 'math1', 'math2'));

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_exam_questions_module_type ON public.exam_questions(module_type);

-- Update the unique constraint to include module_type and question_number
ALTER TABLE public.exam_questions 
DROP CONSTRAINT IF EXISTS exam_question_unique;

-- Add new unique constraint that allows same question in different modules/positions
ALTER TABLE public.exam_questions 
ADD CONSTRAINT exam_question_module_unique UNIQUE (exam_id, question_id, module_type, question_number);