-- FIX QUESTIONS TABLE RLS POLICIES
-- This script fixes the Row Level Security policies for the questions table
-- to allow student accounts to read questions in the problem bank

-- 1. Check current policies on questions table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'questions';

-- 2. Drop any existing restrictive policies on questions table
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'questions' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON questions';
    END LOOP;
END $$;

-- 3. Ensure RLS is enabled on questions table
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- 4. Create a permissive SELECT policy for questions
-- Questions should be readable by all authenticated users (students and admins)
CREATE POLICY "questions_select_policy" ON questions
    FOR SELECT 
    USING (
        -- Allow all authenticated users to read questions
        auth.uid() IS NOT NULL
    );

-- 5. Create INSERT policy for questions (admin only)
CREATE POLICY "questions_insert_policy" ON questions
    FOR INSERT 
    WITH CHECK (
        -- Only admins can insert questions
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 6. Create UPDATE policy for questions (admin only)
CREATE POLICY "questions_update_policy" ON questions
    FOR UPDATE 
    USING (
        -- Only admins can update questions
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 7. Create DELETE policy for questions (admin only)
CREATE POLICY "questions_delete_policy" ON questions
    FOR DELETE 
    USING (
        -- Only admins can delete questions
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 8. Test function to verify questions access
CREATE OR REPLACE FUNCTION test_questions_access()
RETURNS TABLE (
    test_name TEXT,
    success BOOLEAN,
    count_result INTEGER,
    error_message TEXT
) AS $$
DECLARE
    current_uid UUID;
    question_count INTEGER;
    user_role TEXT;
BEGIN
    current_uid := auth.uid();
    
    -- Check current user's role
    SELECT role FROM user_profiles WHERE id = current_uid INTO user_role;
    
    -- Test: Can read questions
    BEGIN
        SELECT COUNT(*) FROM questions INTO question_count;
        RETURN QUERY VALUES ('read_questions', true, question_count, 'User role: ' || COALESCE(user_role, 'unknown'));
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('read_questions', false, 0, SQLERRM);
    END;
    
    -- Test: Auth status
    RETURN QUERY VALUES ('auth_check', current_uid IS NOT NULL, 0, 'Auth UID: ' || COALESCE(current_uid::TEXT, 'NULL'));
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to all authenticated users
GRANT EXECUTE ON FUNCTION test_questions_access() TO authenticated;

-- 9. Show final policies
SELECT 'Final questions policies:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'questions';

-- Instructions:
-- 1. Run this script in Supabase SQL Editor
-- 2. Test with: SELECT * FROM test_questions_access();
-- 3. The read_questions test should return success = true with a count > 0
-- 4. If it still fails, there may be other issues with authentication or user_profiles table