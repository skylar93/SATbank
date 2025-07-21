-- Fix questions RLS policy to support problem bank functionality
-- Students should be able to access all questions for practice, not just exam-linked ones

-- Drop the restrictive questions policy that requires active exams
DROP POLICY IF EXISTS "Users can view questions for active exams" ON questions;

-- Create a new policy that allows authenticated users to view all questions
-- This is safe because questions are public content for educational purposes
CREATE POLICY "Authenticated users can view all questions" ON questions
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Keep the admin policies unchanged
-- (Admins can still view, create, update, delete questions)

-- Also ensure questions can be queried independently of exams by making exam_id nullable
-- for problem bank questions (this will be handled in the application layer)
ALTER TABLE questions ALTER COLUMN exam_id DROP NOT NULL;

-- Add a comment to clarify the new design
COMMENT ON POLICY "Authenticated users can view all questions" ON questions IS 
'Allows authenticated users to access all questions for problem bank functionality. Questions are educational content and safe to expose to authenticated users.';