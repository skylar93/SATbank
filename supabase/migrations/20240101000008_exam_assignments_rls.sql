-- RLS Policies for Exam Assignments Feature
-- Updates policies to restrict student access to assigned exams only

-- Enable RLS on exam_assignments table
ALTER TABLE exam_assignments ENABLE ROW LEVEL SECURITY;

-- EXAM_ASSIGNMENTS policies
-- Students can view their own assignments
CREATE POLICY "Students can view own assignments" ON exam_assignments
    FOR SELECT USING (auth.uid() = student_id);

-- Admins can view all assignments
CREATE POLICY "Admins can view all assignments" ON exam_assignments
    FOR SELECT USING (is_admin(auth.uid()));

-- Only admins can create assignments
CREATE POLICY "Admins can create assignments" ON exam_assignments
    FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- Only admins can update assignments
CREATE POLICY "Admins can update assignments" ON exam_assignments
    FOR UPDATE USING (is_admin(auth.uid()));

-- Only admins can delete assignments
CREATE POLICY "Admins can delete assignments" ON exam_assignments
    FOR DELETE USING (is_admin(auth.uid()));

-- Update EXAMS policies to respect assignments
-- Drop existing student exam policy
DROP POLICY "Users can view active exams" ON exams;

-- New policy: Students can only view assigned exams
CREATE POLICY "Students can view assigned exams" ON exams
    FOR SELECT USING (
        -- Admins can see all active exams
        (is_admin(auth.uid()) AND is_active = true)
        OR
        -- Students can only see exams assigned to them
        (
            NOT is_admin(auth.uid()) 
            AND is_active = true
            AND EXISTS (
                SELECT 1 FROM exam_assignments
                WHERE exam_assignments.exam_id = exams.id
                AND exam_assignments.student_id = auth.uid()
                AND exam_assignments.is_active = true
            )
        )
    );

-- Update TEST_ATTEMPTS policies to respect assignments
-- Drop existing student test attempt creation policy
DROP POLICY "Users can create own test attempts" ON test_attempts;

-- New policy: Students can only create attempts for assigned exams
CREATE POLICY "Students can create attempts for assigned exams" ON test_attempts
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND (
            -- Admins can create attempts for any exam
            is_admin(auth.uid())
            OR
            -- Students can only create attempts for assigned exams
            EXISTS (
                SELECT 1 FROM exam_assignments
                WHERE exam_assignments.exam_id = test_attempts.exam_id
                AND exam_assignments.student_id = auth.uid()
                AND exam_assignments.is_active = true
            )
        )
    );

-- Update QUESTIONS policies to respect assignments
-- Drop existing student questions policy
DROP POLICY "Users can view questions for active exams" ON questions;

-- New policy: Students can only view questions for assigned exams
CREATE POLICY "Students can view questions for assigned exams" ON questions
    FOR SELECT USING (
        -- Admins can view all questions for active exams
        (
            is_admin(auth.uid())
            AND EXISTS (
                SELECT 1 FROM exams 
                WHERE exams.id = questions.exam_id 
                AND exams.is_active = true
            )
        )
        OR
        -- Students can only view questions for assigned exams
        (
            NOT is_admin(auth.uid())
            AND EXISTS (
                SELECT 1 FROM exams 
                WHERE exams.id = questions.exam_id 
                AND exams.is_active = true
            )
            AND EXISTS (
                SELECT 1 FROM exam_assignments
                WHERE exam_assignments.exam_id = questions.exam_id
                AND exam_assignments.student_id = auth.uid()
                AND exam_assignments.is_active = true
            )
        )
    );