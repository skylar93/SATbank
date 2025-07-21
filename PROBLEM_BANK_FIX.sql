-- PROBLEM BANK FIX: Run this SQL in your Supabase SQL Editor
-- This fixes the RLS policy that prevents students from accessing questions

-- Step 1: Drop the restrictive policy that requires active exams
DROP POLICY IF EXISTS "Users can view questions for active exams" ON questions;

-- Step 2: Create a new policy that allows authenticated users to view all questions
CREATE POLICY "Authenticated users can view all questions" ON questions
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Step 3: Make exam_id nullable for problem bank questions
ALTER TABLE questions ALTER COLUMN exam_id DROP NOT NULL;

-- Step 4: Add a comment explaining the change
COMMENT ON POLICY "Authenticated users can view all questions" ON questions IS 
'Allows authenticated users to access all questions for problem bank functionality. Questions are educational content and safe to expose to authenticated users.';

-- Verification query - run this to test the fix
-- SELECT COUNT(*) as total_questions FROM questions;
-- This should return the number of questions without any RLS errors