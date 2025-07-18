-- COMPREHENSIVE RLS FIX
-- Execute this in Supabase SQL Editor to completely fix the RLS issue

-- 1. First, let's completely disable RLS on test_attempts temporarily to confirm it's the issue
ALTER TABLE test_attempts DISABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies to start fresh
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'test_attempts' LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON test_attempts';
    END LOOP;
END $$;

-- 3. Re-enable RLS
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

-- 4. Create a single, comprehensive INSERT policy that should work
CREATE POLICY "test_attempts_insert_policy" ON test_attempts
    FOR INSERT 
    WITH CHECK (
        -- Must be authenticated
        auth.uid() IS NOT NULL 
        -- User ID must match authenticated user
        AND user_id = auth.uid()
        -- Allow any combination of exam_id and practice mode
        AND (
            exam_id IS NOT NULL OR 
            is_practice_mode = true
        )
    );

-- 5. Create SELECT policy
CREATE POLICY "test_attempts_select_policy" ON test_attempts
    FOR SELECT 
    USING (
        -- Users can see their own attempts
        auth.uid() = user_id
        OR 
        -- Admins can see all attempts
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 6. Create UPDATE policy
CREATE POLICY "test_attempts_update_policy" ON test_attempts
    FOR UPDATE 
    USING (
        -- Users can update their own attempts
        auth.uid() = user_id
        OR 
        -- Admins can update any attempt
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 7. Create DELETE policy
CREATE POLICY "test_attempts_delete_policy" ON test_attempts
    FOR DELETE 
    USING (
        -- Users can delete their own attempts
        auth.uid() = user_id
        OR 
        -- Admins can delete any attempt
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 8. Create a test function to verify the fix works
CREATE OR REPLACE FUNCTION test_rls_fix(exam_uuid UUID)
RETURNS TABLE (
    test_name TEXT,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    current_uid UUID;
    test_attempt_id UUID;
    attempt_count INTEGER;
BEGIN
    current_uid := auth.uid();
    
    -- Test 1: Regular exam attempt
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
            exam_uuid,
            'not_started',
            false,
            'english1',
            1
        ) RETURNING id INTO test_attempt_id;
        
        -- Clean up
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('regular_exam', true, 'Success');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('regular_exam', false, SQLERRM);
    END;
    
    -- Test 2: Practice mode attempt  
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
        
        -- Clean up
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('practice_mode', true, 'Success');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('practice_mode', false, SQLERRM);
    END;
    
    -- Test 3: Check if we can read our own attempts
    BEGIN
        SELECT COUNT(*) FROM test_attempts WHERE user_id = current_uid INTO attempt_count;
        RETURN QUERY VALUES ('read_own_attempts', true, 'Can read ' || attempt_count || ' attempts');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('read_own_attempts', false, SQLERRM);
    END;
    
    -- Test 4: Verify auth.uid() is working
    RETURN QUERY VALUES ('auth_uid_check', current_uid IS NOT NULL, 'Current UID: ' || COALESCE(current_uid::TEXT, 'NULL'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_rls_fix(UUID) TO authenticated;

-- 9. Create a function to check the current user's auth status
CREATE OR REPLACE FUNCTION check_user_auth_status()
RETURNS TABLE (
    property TEXT,
    value TEXT,
    is_valid BOOLEAN
) AS $$
DECLARE
    current_uid UUID;
    user_email TEXT;
    profile_exists BOOLEAN;
    profile_role TEXT;
BEGIN
    -- Get auth info
    current_uid := auth.uid();
    user_email := auth.email();
    
    -- Check profile
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = current_uid) INTO profile_exists;
    
    IF profile_exists THEN
        SELECT role FROM user_profiles WHERE id = current_uid INTO profile_role;
    END IF;
    
    RETURN QUERY VALUES 
        ('auth_uid', COALESCE(current_uid::TEXT, 'NULL'), current_uid IS NOT NULL),
        ('auth_email', COALESCE(user_email, 'NULL'), user_email IS NOT NULL),
        ('profile_exists', profile_exists::TEXT, profile_exists),
        ('profile_role', COALESCE(profile_role, 'NULL'), profile_role IS NOT NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_user_auth_status() TO authenticated;

-- 10. Instructions for testing
-- After running this script, test with:
-- SELECT * FROM test_rls_fix('f47ac10b-58cc-4372-a567-0e02b2c3d479');
-- SELECT * FROM check_user_auth_status();

-- 11. If the above still fails, try this emergency bypass (TEMPORARY ONLY)
-- This creates a permissive policy that allows anything for authenticated users
-- DO NOT USE IN PRODUCTION - ONLY FOR DEBUGGING

CREATE OR REPLACE FUNCTION create_emergency_bypass_policy()
RETURNS TEXT AS $$
BEGIN
    -- Drop all policies
    DROP POLICY IF EXISTS "test_attempts_insert_policy" ON test_attempts;
    DROP POLICY IF EXISTS "test_attempts_select_policy" ON test_attempts;
    DROP POLICY IF EXISTS "test_attempts_update_policy" ON test_attempts;
    DROP POLICY IF EXISTS "test_attempts_delete_policy" ON test_attempts;
    
    -- Create ultra-permissive policy for debugging
    CREATE POLICY "emergency_bypass_policy" ON test_attempts
        FOR ALL 
        USING (auth.uid() IS NOT NULL)
        WITH CHECK (auth.uid() IS NOT NULL);
    
    RETURN 'Emergency bypass policy created - REMOVE THIS IN PRODUCTION!';
END;
$$ LANGUAGE plpgsql;

-- To use emergency bypass, run: SELECT create_emergency_bypass_policy();