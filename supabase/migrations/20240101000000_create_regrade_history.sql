-- Create regrade_history table for tracking question re-grading actions
CREATE TABLE regrade_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_answer_id UUID NOT NULL REFERENCES user_answers(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_is_correct BOOLEAN,
  new_is_correct BOOLEAN NOT NULL,
  reason TEXT NOT NULL,
  regraded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_regrade_history_user_answer_id ON regrade_history(user_answer_id);
CREATE INDEX idx_regrade_history_attempt_id ON regrade_history(attempt_id);
CREATE INDEX idx_regrade_history_admin_id ON regrade_history(admin_id);
CREATE INDEX idx_regrade_history_regraded_at ON regrade_history(regraded_at);

-- Enable RLS
ALTER TABLE regrade_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Only admins can access regrade history
CREATE POLICY "Admin users can view regrade history" ON regrade_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can insert regrade history" ON regrade_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add comment for documentation
COMMENT ON TABLE regrade_history IS 'Tracks all question re-grading actions performed by administrators';
COMMENT ON COLUMN regrade_history.user_answer_id IS 'Reference to the user answer that was regraded';
COMMENT ON COLUMN regrade_history.attempt_id IS 'Reference to the test attempt containing the regraded question';
COMMENT ON COLUMN regrade_history.admin_id IS 'ID of the admin who performed the regrade';
COMMENT ON COLUMN regrade_history.old_is_correct IS 'Previous correctness status (null if it was not set)';
COMMENT ON COLUMN regrade_history.new_is_correct IS 'New correctness status after regrade';
COMMENT ON COLUMN regrade_history.reason IS 'Reason provided by admin for the regrade';
COMMENT ON COLUMN regrade_history.regraded_at IS 'Timestamp when the regrade was performed';