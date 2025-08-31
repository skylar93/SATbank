-- Temporary fix: Allow students to start custom assignments
-- This is a simple fix to resolve the immediate 401 error

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can create own attempts" ON public.test_attempts;
DROP POLICY IF EXISTS "Users can create test attempts for accessible exams" ON public.test_attempts;

-- Create a temporary permissive policy that allows custom assignments
CREATE POLICY "Users can create test attempts including custom assignments"
ON public.test_attempts
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    -- Note: Temporarily allowing all custom assignments
    -- This should be refined with proper assignment checking later
);

COMMENT ON POLICY "Users can create test attempts including custom assignments" ON public.test_attempts 
IS 'Temporary permissive policy to fix 401 errors on custom assignments. Should be refined with proper assignment validation.';