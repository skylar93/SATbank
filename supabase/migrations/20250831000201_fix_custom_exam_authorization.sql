-- Migration File: 20250831000201_fix_custom_exam_authorization.sql
-- Fix authorization issue for custom mistake exams by creating proper assignment tracking and RLS policies

-- 1. Create exam_assignments table to track which custom exams are assigned to which students
-- Note: Using student_id to match existing code structure
CREATE TABLE IF NOT EXISTS public.exam_assignments (
    id BIGSERIAL PRIMARY KEY,
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_date TIMESTAMPTZ,
    show_results BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    CONSTRAINT exam_assignment_unique UNIQUE (exam_id, student_id)
);

COMMENT ON TABLE public.exam_assignments IS 'Links custom exams (assignments) to specific students who are allowed to take them.';

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_exam_assignments_student_id ON public.exam_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_exam_id ON public.exam_assignments(exam_id);

-- 3. Create helper function to check if an exam is assigned to a user
CREATE OR REPLACE FUNCTION is_exam_assigned_to_user(p_exam_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.exam_assignments
    WHERE exam_id = p_exam_id AND student_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable RLS on exam_assignments table
ALTER TABLE public.exam_assignments ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for exam_assignments
-- Students can only see their own assignments
CREATE POLICY "Students can view their own assignments" ON public.exam_assignments
    FOR SELECT
    USING (auth.uid() = student_id);

-- Admins can manage all assignments
CREATE POLICY "Admins can manage all assignments" ON public.exam_assignments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 6. Fix the test_attempts RLS policy to handle custom assignments
-- First, drop the existing policy if it exists
DROP POLICY IF EXISTS "Users can create their own test attempts" ON public.test_attempts;
DROP POLICY IF EXISTS "Users can insert their own test attempts" ON public.test_attempts;
DROP POLICY IF EXISTS "Students can create test attempts" ON public.test_attempts;

-- Create the comprehensive policy that handles both regular and custom exams
CREATE POLICY "Users can create authorized test attempts"
ON public.test_attempts
FOR INSERT
TO authenticated
WITH CHECK (
    -- The user ID must match the logged-in user
    user_id = auth.uid() AND
    (
        -- Condition 1: The exam is a REGULAR exam (not a custom assignment)
        (SELECT NOT COALESCE(is_custom_assignment, false) FROM public.exams WHERE id = exam_id)
        OR
        -- Condition 2: The exam IS a custom assignment AND it is assigned to this user
        (
            (SELECT COALESCE(is_custom_assignment, false) FROM public.exams WHERE id = exam_id)
            AND
            is_exam_assigned_to_user(exam_id, auth.uid())
        )
    )
);

-- 7. Ensure students can view exams they're assigned to
-- First check if we need to update the existing exam SELECT policy
DROP POLICY IF EXISTS "Students can view active exams" ON public.exams;
DROP POLICY IF EXISTS "Everyone can view active exams" ON public.exams;

CREATE POLICY "Users can view authorized exams"
ON public.exams
FOR SELECT
TO authenticated
USING (
    is_active = true AND
    (
        -- Regular exams can be viewed by everyone
        NOT COALESCE(is_custom_assignment, false)
        OR
        -- Custom assignments can only be viewed by assigned students or admins
        (
            COALESCE(is_custom_assignment, false) = true AND
            (
                is_exam_assigned_to_user(id, auth.uid())
                OR
                EXISTS (
                    SELECT 1 FROM public.user_profiles 
                    WHERE user_profiles.id = auth.uid() 
                    AND role = 'admin'
                )
            )
        )
    )
);

-- 8. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_assignments TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.exam_assignments_id_seq TO authenticated;

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE 'Migration completed successfully. Custom exam authorization has been fixed.';
END $$;