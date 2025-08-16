-- Fix RLS policies for user_answers table to allow admin access for regrading

-- Enable RLS on user_answers table if not already enabled
ALTER TABLE user_answers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own answers" ON user_answers;
DROP POLICY IF EXISTS "Users can insert their own answers" ON user_answers;
DROP POLICY IF EXISTS "Users can update their own answers" ON user_answers;
DROP POLICY IF EXISTS "Admin users can view all answers" ON user_answers;
DROP POLICY IF EXISTS "Admin users can update all answers" ON user_answers;

-- Allow users to view their own answers
CREATE POLICY "Users can view their own answers" ON user_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM test_attempts 
      WHERE test_attempts.id = user_answers.attempt_id 
      AND test_attempts.user_id = auth.uid()
    )
  );

-- Allow users to insert their own answers
CREATE POLICY "Users can insert their own answers" ON user_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM test_attempts 
      WHERE test_attempts.id = user_answers.attempt_id 
      AND test_attempts.user_id = auth.uid()
    )
  );

-- Allow users to update their own answers (during exam)
CREATE POLICY "Users can update their own answers" ON user_answers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM test_attempts 
      WHERE test_attempts.id = user_answers.attempt_id 
      AND test_attempts.user_id = auth.uid()
    )
  );

-- Allow admin users to view all answers
CREATE POLICY "Admin users can view all answers" ON user_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Allow admin users to update all answers (for regrading)
CREATE POLICY "Admin users can update all answers" ON user_answers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Also ensure test_attempts table has proper RLS policies
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

-- Drop existing test_attempts policies if they exist
DROP POLICY IF EXISTS "Users can view their own attempts" ON test_attempts;
DROP POLICY IF EXISTS "Users can insert their own attempts" ON test_attempts;
DROP POLICY IF EXISTS "Users can update their own attempts" ON test_attempts;
DROP POLICY IF EXISTS "Admin users can view all attempts" ON test_attempts;
DROP POLICY IF EXISTS "Admin users can update all attempts" ON test_attempts;

-- Allow users to view their own test attempts
CREATE POLICY "Users can view their own attempts" ON test_attempts
  FOR SELECT USING (user_id = auth.uid());

-- Allow users to insert their own test attempts
CREATE POLICY "Users can insert their own attempts" ON test_attempts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Allow users to update their own test attempts
CREATE POLICY "Users can update their own attempts" ON test_attempts
  FOR UPDATE USING (user_id = auth.uid());

-- Allow admin users to view all test attempts
CREATE POLICY "Admin users can view all attempts" ON test_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Allow admin users to update all test attempts (for score updates after regrading)
CREATE POLICY "Admin users can update all attempts" ON test_attempts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add comment for documentation
COMMENT ON POLICY "Admin users can view all answers" ON user_answers IS 'Allows admin users to view all user answers for regrading purposes';
COMMENT ON POLICY "Admin users can update all answers" ON user_answers IS 'Allows admin users to update user answers for regrading purposes';
COMMENT ON POLICY "Admin users can view all attempts" ON test_attempts IS 'Allows admin users to view all test attempts for management purposes';
COMMENT ON POLICY "Admin users can update all attempts" ON test_attempts IS 'Allows admin users to update test attempts for score recalculation after regrading';