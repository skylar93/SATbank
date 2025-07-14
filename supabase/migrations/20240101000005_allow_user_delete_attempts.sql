-- Allow users to delete their own test attempts
-- This enables the "discard" functionality for in-progress exams

-- Add policy to allow users to delete their own test attempts
CREATE POLICY "Users can delete own test attempts" ON test_attempts
    FOR DELETE USING (
        auth.uid() = user_id 
        AND status = 'in_progress'
    );

-- Also ensure user_answers can be deleted by users for their own attempts
-- (This is already handled by the ExamService.deleteTestAttempt method)
DROP POLICY IF EXISTS "Users can delete own answers" ON user_answers;
CREATE POLICY "Users can delete own answers" ON user_answers
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM test_attempts 
            WHERE test_attempts.id = user_answers.attempt_id 
            AND test_attempts.user_id = auth.uid()
            AND test_attempts.status = 'in_progress'
        )
    );