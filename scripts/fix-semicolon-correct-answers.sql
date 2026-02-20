-- Normalize semicolon-separated correct answers into arrays

-- Update questions that have a semicolon-separated correct_answer string
UPDATE questions
SET correct_answers = string_to_array(correct_answer::text, ';'),
    correct_answer = (string_to_array(correct_answer::text, ';'))[1]
WHERE question_type = 'grid_in'
  AND correct_answer::text LIKE '%;%';

-- Update questions where the first element of correct_answers contains a semicolon
UPDATE questions
SET correct_answers = string_to_array(correct_answers[1], ';'),
    correct_answer = (string_to_array(correct_answers[1], ';'))[1]
WHERE question_type = 'grid_in'
  AND correct_answers IS NOT NULL
  AND array_length(correct_answers, 1) = 1
  AND correct_answers[1] LIKE '%;%';
