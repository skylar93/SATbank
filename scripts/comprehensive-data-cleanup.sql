-- Comprehensive data cleanup for correct_answer and correct_answers fields
-- Fixes multiple issues: array format, double JSON encoding, inconsistent formats

-- 1. Preview what will be changed
SELECT
  'GRID_IN ISSUES' as category,
  id,
  question_number,
  correct_answer,
  correct_answers,
  CASE
    WHEN jsonb_typeof(correct_answer) = 'array' AND jsonb_array_length(correct_answer) = 1
      THEN 'Fix: convert [' || (correct_answer->>0) || '] to "' || (correct_answer->>0) || '"'
    ELSE 'OK'
  END as correct_answer_fix,
  CASE
    WHEN correct_answers IS NOT NULL AND array_length(correct_answers, 1) = 1
         AND correct_answers[1] LIKE '[%]'
      THEN 'Fix: decode double JSON encoding'
    ELSE 'OK'
  END as correct_answers_fix
FROM questions
WHERE question_type = 'grid_in'
  AND (
    jsonb_typeof(correct_answer) = 'array'
    OR (correct_answers IS NOT NULL AND correct_answers[1] LIKE '[%]')
  )
ORDER BY question_number;

-- 2. Fix correct_answer: Convert ["168"] -> "168"
UPDATE questions
SET correct_answer = to_jsonb(correct_answer->>0)
WHERE question_type = 'grid_in'
  AND jsonb_typeof(correct_answer) = 'array'
  AND jsonb_array_length(correct_answer) = 1;

-- 3. Fix correct_answers: Decode double JSON encoding
-- Convert ["[\"168\"]"] -> ["168"]
UPDATE questions
SET correct_answers = ARRAY[correct_answer->>0]
WHERE question_type = 'grid_in'
  AND correct_answers IS NOT NULL
  AND array_length(correct_answers, 1) = 1
  AND correct_answers[1] LIKE '[%]';

-- 4. Ensure grid_in questions have proper correct_answers array
-- If correct_answers is null but we have correct_answer, create the array
UPDATE questions
SET correct_answers = ARRAY[correct_answer->>0]
WHERE question_type = 'grid_in'
  AND correct_answers IS NULL
  AND correct_answer IS NOT NULL;

-- 5. Final verification
SELECT
  'FINAL CHECK' as category,
  question_type,
  COUNT(*) as total,
  COUNT(CASE WHEN jsonb_typeof(correct_answer) = 'string' THEN 1 END) as correct_answer_strings,
  COUNT(CASE WHEN jsonb_typeof(correct_answer) = 'array' THEN 1 END) as correct_answer_arrays,
  COUNT(CASE WHEN correct_answers IS NOT NULL THEN 1 END) as has_correct_answers,
  COUNT(CASE WHEN correct_answers IS NOT NULL AND correct_answers[1] LIKE '[%]' THEN 1 END) as still_double_encoded
FROM questions
GROUP BY question_type;

-- 6. Sample of cleaned data
SELECT
  'SAMPLE CLEANED' as category,
  id,
  question_number,
  correct_answer,
  correct_answers
FROM questions
WHERE question_type = 'grid_in'
ORDER BY question_number
LIMIT 5;