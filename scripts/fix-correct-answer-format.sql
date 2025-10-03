-- Fix correct_answer format: Convert ["A"] to "A" for single-letter answers
-- This script identifies and fixes array-formatted single letters in correct_answer field

-- First, let's see what we're working with
SELECT
  id,
  question_number,
  correct_answer,
  pg_typeof(correct_answer) as data_type,
  CASE
    WHEN jsonb_typeof(correct_answer) = 'array'
         AND jsonb_array_length(correct_answer) = 1
         AND length(correct_answer->>0) = 1
    THEN 'NEEDS_FIX'
    ELSE 'OK'
  END as status
FROM questions
WHERE jsonb_typeof(correct_answer) = 'array'
  AND jsonb_array_length(correct_answer) = 1
  AND length(correct_answer->>0) = 1;

-- Update query to fix the format
-- This converts ["A"] -> "A", ["B"] -> "B", etc.
UPDATE questions
SET correct_answer = to_jsonb(correct_answer->>0)
WHERE jsonb_typeof(correct_answer) = 'array'
  AND jsonb_array_length(correct_answer) = 1
  AND length(correct_answer->>0) = 1;

-- Verification query
SELECT
  id,
  question_number,
  correct_answer,
  pg_typeof(correct_answer) as data_type
FROM questions
WHERE correct_answer IN ('"A"', '"B"', '"C"', '"D"')
ORDER BY question_number;