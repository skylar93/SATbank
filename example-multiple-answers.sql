-- 🎯 실제 SAT Grid-in 문제들의 Multiple Answers 예시
-- 이 SQL을 Supabase SQL Editor에서 실행하세요!

-- 예시 1: 분수와 소수 동등값
INSERT INTO questions (
    exam_id, module_type, question_number, question_type, content,
    correct_answers, difficulty_level, explanation
) VALUES (
    1, 'math_calculator', 25, 'grid_in',
    'A recipe calls for 3/4 cup of flour. What is this amount as a decimal?',
    ARRAY['0.75', '3/4', '6/8', '9/12', '12/16', '15/20'], -- 수학적 동등값들
    'easy',
    'All of these represent the same value: 3÷4 = 0.75'
);

-- 예시 2: 정수 답안의 다양한 형태
INSERT INTO questions (
    exam_id, module_type, question_number, question_type, content,
    correct_answers, difficulty_level
) VALUES (
    1, 'math_no_calculator', 15, 'grid_in',
    'If 3x - 7 = 41, what is the value of x?',
    ARRAY['16', '16.0', '16.00', '48/3'], -- 정수의 다양한 표현
    'medium'
);

-- 예시 3: 복잡한 분수 문제
INSERT INTO questions (
    exam_id, module_type, question_number, question_type, content,
    correct_answers, difficulty_level
) VALUES (
    1, 'math_calculator', 30, 'grid_in',
    'What is 7/8 expressed as a decimal?',
    ARRAY['0.875', '7/8', '14/16', '21/24', '28/32'], -- 동등한 분수들
    'medium'
);

-- 예시 4: 백분율과 소수
INSERT INTO questions (
    exam_id, module_type, question_number, question_type, content,
    correct_answers, difficulty_level
) VALUES (
    1, 'math_calculator', 35, 'grid_in',
    'Express 25% as a decimal.',
    ARRAY['0.25', '0.250', '1/4', '2/8', '25/100'], -- 백분율의 다양한 형태
    'easy'
);

-- 예시 5: 복잡한 수학 계산
INSERT INTO questions (
    exam_id, module_type, question_number, question_type, content,
    correct_answers, difficulty_level
) VALUES (
    1, 'math_calculator', 40, 'grid_in',
    'If f(x) = 2x + 1 and f(a) = 9, what is the value of a?',
    ARRAY['4', '4.0', '8/2', '12/3'], -- 방정식 해의 다양한 표현
    'hard'
);

-- 예시 6: 근삿값이 허용되는 경우 (주의: SAT에서는 정확한 값만 허용)
INSERT INTO questions (
    exam_id, module_type, question_number, question_type, content,
    correct_answers, difficulty_level, explanation
) VALUES (
    1, 'math_calculator', 45, 'grid_in',
    'What is 1/3 as a decimal? (Round to 4 decimal places)',
    ARRAY['0.3333', '1/3'], -- 반올림된 값과 정확한 분수
    'medium',
    'Note: In actual SAT, both the exact fraction and properly rounded decimal are accepted'
);

-- 예시 7: 지수 표현
INSERT INTO questions (
    exam_id, module_type, question_number, question_type, content,
    correct_answers, difficulty_level
) VALUES (
    1, 'math_calculator', 50, 'grid_in',
    'What is 2^3?',
    ARRAY['8', '8.0', '16/2', '24/3'], -- 지수의 다양한 표현
    'easy'
);