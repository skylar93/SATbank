-- Add final_scores column to test_attempts table
ALTER TABLE test_attempts 
ADD COLUMN final_scores JSONB;

-- Add comment for documentation
COMMENT ON COLUMN test_attempts.final_scores IS 'Final calculated scores from the scoring engine: {overall: number, english: number, math: number}';