-- EMERGENCY FIX FOR QUESTIONS TABLE
-- This temporarily disables RLS on questions table to allow student access
-- USE ONLY FOR IMMEDIATE TESTING - NOT FOR PRODUCTION

-- 1. Disable RLS on questions table temporarily
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;

-- 2. Re-enable with a simple permissive policy
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- 3. Create ultra-permissive policy for all authenticated users
CREATE POLICY "emergency_questions_access" ON questions
    FOR ALL 
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Verify the fix works
SELECT 'Questions table RLS emergency fix applied' as status;
SELECT COUNT(*) as total_questions FROM questions;

-- To revert this emergency fix later, run:
-- DROP POLICY "emergency_questions_access" ON questions;
-- Then apply proper RLS policies from FIX_QUESTIONS_RLS.sql