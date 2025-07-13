-- Update exam configuration for testing with 12 questions
-- Shorter time limits for testing purposes

UPDATE exams 
SET 
    total_questions = 12,
    time_limits = '{
        "english1": 5,
        "english2": 3,
        "math1": 4,
        "math2": 6
    }'::jsonb,
    description = 'SAT Practice Test with 12 sample questions (3 per module) - Perfect for testing the exam system!'
WHERE id = '550e8400-e29b-41d4-a716-446655440000';