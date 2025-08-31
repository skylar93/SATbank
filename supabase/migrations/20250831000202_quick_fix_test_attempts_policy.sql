-- Quick fix for test_attempts RLS policy to allow custom assignments
-- This addresses the immediate 401 error for mistake exams

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can create own attempts" ON public.test_attempts;

-- Create a more permissive policy temporarily
CREATE POLICY "Users can create test attempts for accessible exams"
ON public.test_attempts
FOR INSERT
TO authenticated
WITH CHECK (
    -- The user ID must match the logged-in user
    user_id = auth.uid() AND
    (
        -- Allow for regular exams (non-custom assignments)
        (SELECT NOT COALESCE(is_custom_assignment, false) FROM public.exams WHERE id = exam_id)
        OR
        -- For custom assignments, check if there's an assignment record
        -- Note: This will work if exam_assignments table exists, otherwise defaults to allow
        (
            (SELECT COALESCE(is_custom_assignment, false) FROM public.exams WHERE id = exam_id) AND
            (
                -- Check if assignment exists (if table exists)
                NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'exam_assignments')
                OR
                EXISTS (
                    SELECT 1 FROM public.exam_assignments 
                    WHERE exam_id = test_attempts.exam_id 
                    AND student_id = auth.uid()
                    AND is_active = true
                )
            )
        )
    )
);

-- Add a comment to explain this is a temporary fix
COMMENT ON POLICY "Users can create test attempts for accessible exams" ON public.test_attempts 
IS 'Temporary policy allowing custom assignment access. Will be refined once exam_assignments table is properly set up.';