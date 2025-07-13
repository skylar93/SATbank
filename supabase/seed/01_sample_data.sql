-- Sample data for testing SAT Mock Exam & Problem Bank
-- This file creates test data for development and testing

-- Insert sample exam
INSERT INTO exams (id, title, description, is_mock_exam, is_active, total_questions, time_limits) VALUES
(
    '550e8400-e29b-41d4-a716-446655440000',
    'SAT Practice Test #1',
    'Official SAT Practice Test with all 4 modules',
    true,
    true,
    154,
    '{
        "english1": 64,
        "english2": 35,
        "math1": 35,
        "math2": 55
    }'::jsonb
);

-- Insert sample questions for English Module 1
INSERT INTO questions (exam_id, module_type, question_number, question_type, difficulty_level, question_text, options, correct_answer, explanation, points, topic_tags) VALUES

-- English Module 1 Questions
('550e8400-e29b-41d4-a716-446655440000', 'english1', 1, 'multiple_choice', 'medium', 
'Which choice most logically completes the text?

Paleontologists have long debated whether ancient pterosaurs were capable of powered flight or merely glided from elevated positions. Recent biomechanical analyses of pterosaur wing bone density and muscle attachment sites _______ that these creatures possessed the necessary anatomical features for sustained, powered flight.',
'{"A": "suggest", "B": "deny", "C": "question", "D": "ignore"}'::jsonb,
'A',
'The sentence indicates that the analyses provided evidence supporting powered flight capability, so "suggest" is the most logical choice.',
1,
ARRAY['reading comprehension', 'logical completion']
),

('550e8400-e29b-41d4-a716-446655440000', 'english1', 2, 'multiple_choice', 'easy',
'While researching a topic, a student has taken the following notes:

• Marie Curie was born in Poland in 1867
• She moved to Paris to study at the Sorbonne
• She discovered the elements polonium and radium
• She was the first woman to win a Nobel Prize
• She won Nobel Prizes in both Physics (1903) and Chemistry (1911)

The student wants to emphasize Marie Curie''s unique achievement in Nobel Prize history. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
'{"A": "Marie Curie, born in Poland in 1867, moved to Paris to study.", "B": "Marie Curie discovered two new elements, polonium and radium.", "C": "Marie Curie was the first woman to win a Nobel Prize in 1903.", "D": "Marie Curie was the first person to win Nobel Prizes in two different sciences."}'::jsonb,
'D',
'Choice D emphasizes her unique achievement of winning Nobel Prizes in two different scientific fields, which is historically unprecedented.',
1,
ARRAY['writing', 'synthesis', 'historical context']
),

-- Math Module 1 Questions  
('550e8400-e29b-41d4-a716-446655440000', 'math1', 1, 'multiple_choice', 'medium',
'If 3x + 7 = 22, what is the value of 6x + 14?',
'{"A": "30", "B": "44", "C": "15", "D": "22"}'::jsonb,
'B',
'First solve for x: 3x + 7 = 22, so 3x = 15, so x = 5. Then 6x + 14 = 6(5) + 14 = 30 + 14 = 44.',
1,
ARRAY['algebra', 'linear equations']
),

('550e8400-e29b-41d4-a716-446655440000', 'math1', 2, 'multiple_choice', 'hard',
'A function f is defined by f(x) = ax² + bx + c, where a, b, and c are constants. If f(1) = 10, f(2) = 17, and f(3) = 26, what is the value of a?',
'{"A": "1", "B": "2", "C": "3", "D": "4"}'::jsonb,
'A',
'Setting up the system: f(1) = a + b + c = 10, f(2) = 4a + 2b + c = 17, f(3) = 9a + 3b + c = 26. Solving this system yields a = 1.',
1,
ARRAY['quadratic functions', 'system of equations']
),

-- Math Module 2 Questions
('550e8400-e29b-41d4-a716-446655440000', 'math2', 1, 'grid_in', 'medium',
'If sin(θ) = 3/5 and θ is in the first quadrant, what is the value of cos(θ)? (Express your answer as a fraction in lowest terms.)',
NULL,
'4/5',
'Using the Pythagorean identity: sin²(θ) + cos²(θ) = 1. So (3/5)² + cos²(θ) = 1, which gives cos²(θ) = 1 - 9/25 = 16/25. Since θ is in the first quadrant, cos(θ) = 4/5.',
1,
ARRAY['trigonometry', 'Pythagorean identity']
),

-- English Module 2 Questions
('550e8400-e29b-41d4-a716-446655440000', 'english2', 1, 'multiple_choice', 'medium',
'Text 1: Climate scientists have observed that arctic ice sheets are melting at an unprecedented rate, with some models predicting complete disappearance of summer sea ice within decades.

Text 2: While arctic ice loss is concerning, recent studies show that antarctic ice sheets have actually been gaining mass in some regions, suggesting that global ice dynamics are more complex than initially understood.

Based on these texts, what can be concluded about global ice sheet changes?',
'{"A": "All ice sheets globally are melting at the same rate", "B": "Ice sheet changes vary significantly by geographic region", "C": "Antarctic ice gain compensates for Arctic ice loss", "D": "Climate models are unreliable for predicting ice changes"}'::jsonb,
'B',
'The texts show that Arctic and Antarctic regions are experiencing different trends, indicating regional variation in ice sheet changes.',
1,
ARRAY['reading comprehension', 'synthesis', 'climate science']
);

-- Note: In a real implementation, you would have many more questions (154 total)
-- This is just a sample to demonstrate the structure