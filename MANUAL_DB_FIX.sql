-- MANUAL DATABASE FIX FOR PRACTICE SESSION ISSUES
-- Run this SQL script in your Supabase Dashboard > SQL Editor

-- 1. Create the missing test_auth_uid function for debugging
CREATE OR REPLACE FUNCTION test_auth_uid()
RETURNS TABLE (
    current_auth_uid UUID,
    current_auth_role TEXT,
    auth_user_exists BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        auth.uid() as current_auth_uid,
        auth.role() as current_auth_role,
        (auth.uid() IS NOT NULL) as auth_user_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION test_auth_uid() TO authenticated;

-- 2. Drop and recreate test_attempts policies to ensure they work correctly
DROP POLICY IF EXISTS "Users can create test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Users can update test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Allow practice session creation" ON test_attempts;
DROP POLICY IF EXISTS "Users can create own test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Users can update own test attempts" ON test_attempts;

-- Create a single, comprehensive policy for test attempt creation
CREATE POLICY "users_create_own_test_attempts" ON test_attempts
    FOR INSERT 
    WITH CHECK (
        auth.uid() IS NOT NULL 
        AND user_id = auth.uid()
    );

-- Create a single, comprehensive policy for test attempt updates  
CREATE POLICY "users_update_own_test_attempts" ON test_attempts
    FOR UPDATE 
    USING (
        auth.uid() IS NOT NULL 
        AND user_id = auth.uid()
    );

-- 3. Create debug functions to help troubleshoot
CREATE OR REPLACE FUNCTION debug_practice_creation(test_user_id UUID)
RETURNS TABLE (
    step TEXT,
    success BOOLEAN,
    auth_uid_value UUID,
    provided_user_id UUID,
    ids_match BOOLEAN,
    user_profile_exists BOOLEAN,
    error_details TEXT
) AS $$
DECLARE
    current_auth_uid UUID;
    profile_exists BOOLEAN;
BEGIN
    -- Get current auth uid
    current_auth_uid := auth.uid();
    
    -- Check if user profile exists
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = current_auth_uid) INTO profile_exists;
    
    -- Return step-by-step debug info
    RETURN QUERY VALUES 
        ('auth_check', current_auth_uid IS NOT NULL, current_auth_uid, test_user_id, current_auth_uid = test_user_id, profile_exists, 
         CASE WHEN current_auth_uid IS NULL THEN 'No auth.uid() found' ELSE 'Auth OK' END),
        ('id_match', current_auth_uid = test_user_id, current_auth_uid, test_user_id, current_auth_uid = test_user_id, profile_exists,
         CASE WHEN current_auth_uid != test_user_id THEN 'User ID mismatch' ELSE 'IDs match' END),
        ('profile_check', profile_exists, current_auth_uid, test_user_id, current_auth_uid = test_user_id, profile_exists,
         CASE WHEN NOT profile_exists THEN 'User profile missing' ELSE 'Profile exists' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION debug_practice_creation(UUID) TO authenticated;

-- 4. Create a test function to verify RLS is working
CREATE OR REPLACE FUNCTION test_practice_insert(test_user_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    attempt_id UUID,
    error_message TEXT
) AS $$
DECLARE
    new_attempt_id UUID;
    current_auth_uid UUID;
BEGIN
    current_auth_uid := auth.uid();
    
    -- Try to insert a test attempt
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number
        ) VALUES (
            test_user_id,
            NULL,
            'not_started',
            true,
            'english1',
            1
        ) RETURNING id INTO new_attempt_id;
        
        -- Clean up the test record
        DELETE FROM test_attempts WHERE id = new_attempt_id;
        
        RETURN QUERY VALUES (true, new_attempt_id, 'Success');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES (false, NULL::UUID, SQLERRM);
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users  
GRANT EXECUTE ON FUNCTION test_practice_insert(UUID) TO authenticated;

-- 5. Create an emergency practice session creation function
CREATE OR REPLACE FUNCTION create_practice_session(
    target_user_id UUID,
    module_name TEXT DEFAULT 'english1',
    is_single_question BOOLEAN DEFAULT false
)
RETURNS TABLE (
    success BOOLEAN,
    attempt_id UUID,
    error_message TEXT
) AS $$
DECLARE
    new_attempt_id UUID;
    current_auth_uid UUID;
BEGIN
    current_auth_uid := auth.uid();
    
    -- Verify the requesting user matches the target user
    IF current_auth_uid IS NULL THEN
        RETURN QUERY VALUES (false, NULL::UUID, 'Not authenticated');
        RETURN;
    END IF;
    
    IF current_auth_uid != target_user_id THEN
        RETURN QUERY VALUES (false, NULL::UUID, 'User ID mismatch');
        RETURN;
    END IF;
    
    -- Create the practice attempt
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number,
            created_at,
            updated_at
        ) VALUES (
            target_user_id,
            NULL,
            'not_started',
            true,
            module_name,
            1,
            NOW(),
            NOW()
        ) RETURNING id INTO new_attempt_id;
        
        RETURN QUERY VALUES (true, new_attempt_id, 'Practice session created successfully');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES (false, NULL::UUID, SQLERRM);
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_practice_session(UUID, TEXT, BOOLEAN) TO authenticated;

-- 6. Update user_profiles policies to ensure they work properly
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "authenticated_users_read_own_profile" ON user_profiles;

CREATE POLICY "users_read_own_profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "authenticated_users_read_own_profile" ON user_profiles
    FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = id);

-- 7. Allow users to delete their own test attempts (for the discard functionality)
CREATE POLICY "users_delete_own_test_attempts" ON test_attempts
    FOR DELETE USING (
        auth.uid() = user_id 
        AND status = 'in_progress'
    );

-- Also ensure user_answers can be deleted by users for their own attempts
DROP POLICY IF EXISTS "Users can delete own answers" ON user_answers;
CREATE POLICY "users_delete_own_answers" ON user_answers
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM test_attempts 
            WHERE test_attempts.id = user_answers.attempt_id 
            AND test_attempts.user_id = auth.uid()
            AND test_attempts.status = 'in_progress'
        )
    );

-- 8. Clean up leftover in-progress attempts
-- First, run this to see what in-progress attempts exist:
-- SELECT id, user_id, status, created_at, updated_at 
-- FROM test_attempts 
-- WHERE status = 'in_progress' 
-- ORDER BY created_at DESC;

-- To delete a specific leftover attempt (replace 'ATTEMPT_ID_HERE' with the actual ID):
-- DELETE FROM user_answers WHERE attempt_id = 'ATTEMPT_ID_HERE';
-- DELETE FROM test_attempts WHERE id = 'ATTEMPT_ID_HERE';

-- Or to clean up ALL old in-progress attempts older than 24 hours:
-- DELETE FROM user_answers 
-- WHERE attempt_id IN (
--     SELECT id FROM test_attempts 
--     WHERE status = 'in_progress' 
--     AND updated_at < NOW() - INTERVAL '24 hours'
-- );
-- 
-- DELETE FROM test_attempts 
-- WHERE status = 'in_progress' 
-- AND updated_at < NOW() - INTERVAL '24 hours';