-- MANUAL FIX for RLS Policy Issue
-- Execute this in your Supabase SQL Editor to fix the test_attempts RLS issue

-- First, let's drop the existing problematic policies
DROP POLICY IF EXISTS "users_create_own_test_attempts" ON test_attempts;
DROP POLICY IF EXISTS "practice_mode_creation" ON test_attempts;
DROP POLICY IF EXISTS "Users can create own test attempts" ON test_attempts;

-- Create a more comprehensive policy for test attempt creation
CREATE POLICY "allow_authenticated_users_create_test_attempts" ON test_attempts
    FOR INSERT 
    WITH CHECK (
        auth.uid() IS NOT NULL 
        AND user_id = auth.uid()
        AND (
            -- Allow regular exam attempts
            (exam_id IS NOT NULL AND is_practice_mode = false) OR
            -- Allow practice mode attempts
            (is_practice_mode = true)
        )
    );

-- Also ensure the update policy allows users to update their own attempts
DROP POLICY IF EXISTS "users_update_own_test_attempts" ON test_attempts;
CREATE POLICY "allow_authenticated_users_update_test_attempts" ON test_attempts
    FOR UPDATE 
    USING (
        auth.uid() IS NOT NULL 
        AND user_id = auth.uid()
    );

-- Create a debug function to help troubleshoot RLS issues
CREATE OR REPLACE FUNCTION debug_test_attempt_creation(
    target_user_id UUID,
    target_exam_id UUID,
    is_practice BOOLEAN DEFAULT false
)
RETURNS TABLE (
    step TEXT,
    success BOOLEAN,
    current_auth_uid UUID,
    provided_user_id UUID,
    provided_exam_id UUID,
    ids_match BOOLEAN,
    error_details TEXT
) AS $$
DECLARE
    current_uid UUID;
    test_attempt_id UUID;
BEGIN
    -- Get current auth uid
    current_uid := auth.uid();
    
    -- Return step-by-step debug info
    RETURN QUERY VALUES 
        ('auth_check', current_uid IS NOT NULL, current_uid, target_user_id, target_exam_id, current_uid = target_user_id, 
         CASE WHEN current_uid IS NULL THEN 'No auth.uid() found' ELSE 'Auth OK' END),
        ('id_match', current_uid = target_user_id, current_uid, target_user_id, target_exam_id, current_uid = target_user_id,
         CASE WHEN current_uid != target_user_id THEN 'User ID mismatch' ELSE 'IDs match' END);
    
    -- Try to create a test attempt
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number
        ) VALUES (
            target_user_id,
            target_exam_id,
            'not_started',
            is_practice,
            'english1',
            1
        ) RETURNING id INTO test_attempt_id;
        
        -- Clean up the test record
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('insert_test', true, current_uid, target_user_id, target_exam_id, current_uid = target_user_id, 'Success');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('insert_test', false, current_uid, target_user_id, target_exam_id, current_uid = target_user_id, SQLERRM);
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION debug_test_attempt_creation(UUID, UUID, BOOLEAN) TO authenticated;

-- Create a simple function to verify RLS is working for test attempts
CREATE OR REPLACE FUNCTION verify_test_attempt_rls()
RETURNS TABLE (
    auth_uid UUID,
    can_create_regular_attempt BOOLEAN,
    can_create_practice_attempt BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    current_uid UUID;
    test_exam_id UUID;
    test_attempt_id UUID;
    regular_success BOOLEAN := false;
    practice_success BOOLEAN := false;
    error_msg TEXT := '';
BEGIN
    current_uid := auth.uid();
    
    -- Use a dummy exam ID for testing
    test_exam_id := '00000000-0000-0000-0000-000000000000';
    
    -- Test regular attempt creation
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
        
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        regular_success := true;
        
    EXCEPTION WHEN OTHERS THEN
        error_msg := error_msg || 'Regular attempt error: ' || SQLERRM || '; ';
    END;
    
    -- Test practice attempt creation
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
        
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        practice_success := true;
        
    EXCEPTION WHEN OTHERS THEN
        error_msg := error_msg || 'Practice attempt error: ' || SQLERRM || '; ';
    END;
    
    RETURN QUERY VALUES (current_uid, regular_success, practice_success, error_msg);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION verify_test_attempt_rls() TO authenticated;