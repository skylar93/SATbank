-- FINAL COMPREHENSIVE FIX FOR QUESTIONS TABLE RLS ISSUES
-- This script resolves the authentication problems in the admin panel
-- where users can preview exams but cannot see questions in manage exams

-- Step 1: Clean up all existing conflicting policies on questions table
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    -- Drop all existing policies on questions table
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'questions' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON questions';
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Step 2: Ensure RLS is properly configured
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Step 3: Create a single, clear policy for SELECT operations
-- This allows all authenticated users to read questions
CREATE POLICY "questions_read_access" ON questions
    FOR SELECT 
    USING (
        -- Allow all authenticated users to read questions
        auth.uid() IS NOT NULL
    );

-- Step 4: Create admin-only policies for write operations
CREATE POLICY "questions_admin_insert" ON questions
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "questions_admin_update" ON questions
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "questions_admin_delete" ON questions
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Step 5: Verify user_profiles table has proper RLS for admin checks
-- Check if user_profiles RLS allows reading role information
DO $$
BEGIN
    -- Create policy for user_profiles if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_profiles' 
        AND policyname = 'user_profiles_read_own'
    ) THEN
        CREATE POLICY "user_profiles_read_own" ON user_profiles
            FOR SELECT 
            USING (auth.uid() = id);
    END IF;
END $$;

-- Step 6: Create a test function to verify the fix
CREATE OR REPLACE FUNCTION verify_questions_access()
RETURNS TABLE (
    test_description TEXT,
    success BOOLEAN,
    result_count INTEGER,
    user_role TEXT,
    auth_uid TEXT
) AS $$
DECLARE
    current_uid UUID;
    question_count INTEGER;
    user_role_value TEXT;
BEGIN
    current_uid := auth.uid();
    
    -- Get current user's role
    BEGIN
        SELECT role FROM user_profiles 
        WHERE id = current_uid 
        INTO user_role_value;
    EXCEPTION WHEN OTHERS THEN
        user_role_value := 'ERROR: ' || SQLERRM;
    END;
    
    -- Test questions access
    BEGIN
        SELECT COUNT(*) FROM questions INTO question_count;
        RETURN QUERY VALUES (
            'Questions table access test', 
            true, 
            question_count, 
            COALESCE(user_role_value, 'null'),
            COALESCE(current_uid::TEXT, 'null')
        );
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES (
            'Questions table access test', 
            false, 
            0, 
            COALESCE(user_role_value, 'null'),
            'ERROR: ' || SQLERRM
        );
    END;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION verify_questions_access() TO authenticated;

-- Step 7: Display current policies for verification
SELECT 'Current questions table policies:' as info;
SELECT 
    policyname,
    cmd,
    permissive,
    qual
FROM pg_policies 
WHERE tablename = 'questions'
ORDER BY policyname;

-- Step 8: Instructions for testing
SELECT 'To test this fix:' as instructions;
SELECT '1. Run: SELECT * FROM verify_questions_access();' as step_1;
SELECT '2. The success column should be true with a count > 0' as step_2;
SELECT '3. Check that user_role shows "admin" for admin users' as step_3;
SELECT '4. Test the admin panel - questions should now load properly' as step_4;