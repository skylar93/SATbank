-- Restore Kayla Lim's SAT 2024 NOV USB test attempt
-- Test Attempt ID: d26454bb-64a9-497b-950e-98ba49baa847
-- User: c97a96e0-0bc7-413f-a265-77fa11b79792 (Kayla Lim)
-- Exam: b2c3d4e5-6789-abcd-ef01-23456789abcd (SAT 2024 November US B)

BEGIN;

-- Update the test attempt with backup data
UPDATE test_attempts
SET
  completed_at = '2025-08-16T06:59:37.002+00:00',
  total_score = 1280,
  final_scores = '{"math": 690, "english": 590, "overall": 1280}',
  module_scores = '{"math1": 20, "math2": 15, "english1": 23, "english2": 18}', -- Estimated based on total scores
  updated_at = '2025-08-23T00:16:02.090509+00:00'
WHERE id = 'd26454bb-64a9-497b-950e-98ba49baa847'
  AND user_id = 'c97a96e0-0bc7-413f-a265-77fa11b79792'
  AND exam_id = 'b2c3d4e5-6789-abcd-ef01-23456789abcd';

-- Verify the update
SELECT
  id,
  user_id,
  exam_id,
  status,
  started_at,
  completed_at,
  total_score,
  final_scores,
  module_scores,
  updated_at
FROM test_attempts
WHERE id = 'd26454bb-64a9-497b-950e-98ba49baa847';

COMMIT;