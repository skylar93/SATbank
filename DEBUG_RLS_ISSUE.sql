-- DEBUG RLS ISSUE
-- Execute this in Supabase SQL Editor to debug the exact problem

-- 1. First, let's see what policies currently exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'test_attempts';

-- 2. Check if there are any other policies we missed
SELECT 
    pol.polname as policy_name,
    pol.polcmd as command,
    pol.polqual as using_expression,
    pol.polwithcheck as with_check_expression,
    pol.polroles as roles
FROM pg_policy pol
JOIN pg_class pc ON pol.polrelid = pc.oid
WHERE pc.relname = 'test_attempts';

-- 3. Create a comprehensive debug function to test the exact issue
CREATE OR REPLACE FUNCTION debug_current_user_test_attempt()
RETURNS TABLE (
    step TEXT,
    value TEXT,
    success BOOLEAN,
    details TEXT
) AS $$
DECLARE
    current_uid UUID;
    user_email TEXT;
    user_role TEXT;
    profile_exists BOOLEAN;
    test_exam_id UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    test_attempt_id UUID;
BEGIN
    -- Get current auth info
    current_uid := auth.uid();
    
    -- Get user email
    SELECT auth.email() INTO user_email;
    
    -- Get user role from auth.jwt()
    SELECT auth.jwt() ->> 'role' INTO user_role;
    
    -- Check if user profile exists
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = current_uid) INTO profile_exists;
    
    -- Return debug info step by step
    RETURN QUERY VALUES 
        ('auth_uid', COALESCE(current_uid::TEXT, 'NULL'), current_uid IS NOT NULL, 'Current authenticated user ID'),
        ('auth_email', COALESCE(user_email, 'NULL'), user_email IS NOT NULL, 'Current user email'),
        ('auth_role', COALESCE(user_role, 'NULL'), user_role IS NOT NULL, 'Current user role'),
        ('profile_exists', profile_exists::TEXT, profile_exists, 'User profile exists in user_profiles table'),
        ('exam_id', test_exam_id::TEXT, true, 'Target exam ID');
    
    -- Try to create test attempt with detailed error catching
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number
        ) VALUES (
            current_uid,
            test_exam_id,
            'not_started',
            false,
            'english1',
            1
        ) RETURNING id INTO test_attempt_id;
        
        -- If successful, clean up and report success
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('insert_test', 'SUCCESS', true, 'Test attempt created and deleted successfully');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('insert_test', 'FAILED', false, SQLERRM);
    END;
    
    -- Also try practice mode
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number
        ) VALUES (
            current_uid,
            NULL,
            'not_started',
            true,
            'english1',
            1
        ) RETURNING id INTO test_attempt_id;
        
        -- If successful, clean up and report success
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('insert_practice', 'SUCCESS', true, 'Practice attempt created and deleted successfully');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('insert_practice', 'FAILED', false, SQLERRM);
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION debug_current_user_test_attempt() TO authenticated;

-- 4. Let's also create a function to check the specific exam
CREATE OR REPLACE FUNCTION debug_exam_access(exam_uuid UUID)
RETURNS TABLE (
    check_name TEXT,
    result BOOLEAN,
    details TEXT
) AS $$
DECLARE
    exam_exists BOOLEAN;
    exam_active BOOLEAN;
    user_can_see_exam BOOLEAN;
    current_uid UUID;
BEGIN
    current_uid := auth.uid();
    
    -- Check if exam exists
    SELECT EXISTS(SELECT 1 FROM exams WHERE id = exam_uuid) INTO exam_exists;
    
    -- Check if exam is active
    SELECT is_active FROM exams WHERE id = exam_uuid INTO exam_active;
    
    -- Check if user can see the exam (based on RLS)
    BEGIN
        SELECT EXISTS(SELECT 1 FROM exams WHERE id = exam_uuid) INTO user_can_see_exam;
    EXCEPTION WHEN OTHERS THEN
        user_can_see_exam := false;
    END;
    
    RETURN QUERY VALUES 
        ('exam_exists', exam_exists, 'Exam exists in database'),
        ('exam_active', COALESCE(exam_active, false), 'Exam is active'),
        ('user_can_see_exam', user_can_see_exam, 'User can see exam (RLS check)'),
        ('current_user_id', current_uid IS NOT NULL, 'Current user: ' || COALESCE(current_uid::TEXT, 'NULL'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION debug_exam_access(UUID) TO authenticated;

-- 5. Check what happens when we try to bypass RLS temporarily
-- WARNING: This is for debugging only - do not use in production!
CREATE OR REPLACE FUNCTION debug_rls_bypass_test(exam_uuid UUID)
RETURNS TABLE (
    test_name TEXT,
    success BOOLEAN,
    error_msg TEXT
) AS $$
DECLARE
    current_uid UUID;
    test_attempt_id UUID;
BEGIN
    current_uid := auth.uid();
    
    -- Test 1: Try with RLS enabled (normal)
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode
        ) VALUES (
            current_uid,
            exam_uuid,
            'not_started',
            false
        ) RETURNING id INTO test_attempt_id;
        
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('with_rls', true, 'Success');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('with_rls', false, SQLERRM);
    END;
    
    -- Test 2: Check if we can insert with bypassing RLS (as superuser function)
    BEGIN
        -- This function runs as SECURITY DEFINER so it should bypass RLS
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode
        ) VALUES (
            current_uid,
            exam_uuid,
            'not_started',
            false
        ) RETURNING id INTO test_attempt_id;
        
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('bypass_rls', true, 'Success - RLS is the issue');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('bypass_rls', false, SQLERRM);
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION debug_rls_bypass_test(UUID) TO authenticated;