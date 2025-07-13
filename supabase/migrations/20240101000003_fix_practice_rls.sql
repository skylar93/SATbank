-- Fix RLS policies for practice session creation
-- This addresses issues where practice sessions cannot be created due to RLS

-- Drop existing policies for test_attempts that might be too restrictive
DROP POLICY IF EXISTS "Users can create own test attempts" ON test_attempts;
DROP POLICY IF EXISTS "Users can update own test attempts" ON test_attempts;

-- Create more permissive policies for practice sessions
-- Allow authenticated users to create test attempts where they are the user
CREATE POLICY "Users can create test attempts" ON test_attempts
    FOR INSERT 
    WITH CHECK (
        auth.uid() IS NOT NULL 
        AND user_id = auth.uid()
    );

-- Allow users to update their own test attempts
CREATE POLICY "Users can update test attempts" ON test_attempts
    FOR UPDATE 
    USING (
        auth.uid() IS NOT NULL 
        AND user_id = auth.uid()
    );

-- Also add a policy to allow users to create practice attempts specifically
CREATE POLICY "Allow practice session creation" ON test_attempts
    FOR INSERT 
    WITH CHECK (
        auth.uid() IS NOT NULL 
        AND user_id = auth.uid()
        AND is_practice_mode = true
    );

-- Create a debug function to help troubleshoot auth issues
CREATE OR REPLACE FUNCTION debug_auth_info()
RETURNS TABLE (
    auth_uid UUID,
    auth_role TEXT,
    current_user_id UUID,
    user_exists BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        auth.uid() as auth_uid,
        auth.role() as auth_role,
        auth.uid() as current_user_id,
        EXISTS(SELECT 1 FROM user_profiles WHERE id = auth.uid()) as user_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION debug_auth_info() TO authenticated;