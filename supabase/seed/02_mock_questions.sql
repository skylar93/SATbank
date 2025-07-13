-- Mock Questions for SAT Practice Test #1
-- 3 questions per module for testing purposes
-- Total: 12 questions (3 × 4 modules)

-- Clear existing sample questions first
DELETE FROM questions WHERE exam_id = '550e8400-e29b-41d4-a716-446655440000';

-- ENGLISH MODULE 1 QUESTIONS (Reading & Writing)
INSERT INTO questions (exam_id, module_type, question_number, question_type, difficulty_level, question_text, options, correct_answer, explanation, points, topic_tags) VALUES

-- English 1 - Question 1
('550e8400-e29b-41d4-a716-446655440000', 'english1', 1, 'multiple_choice', 'medium',
'The following text is adapted from Charlotte Perkins Gilman''s 1892 short story "The Yellow Wallpaper."

It is very seldom that mere ordinary people like John and myself secure ancestral halls for the summer. A colonial mansion, a hereditary estate, I would say a haunted house, and reach the height of romantic felicity—but that would be asking too much of fate! Still I will proudly declare that there is something queer about it. Else, why should it be let so cheaply? And why have stood so long untenanted?

Which choice best describes the function of the underlined sentence in the text as a whole?',
'{"A": "It reveals the narrator''s dissatisfaction with the mansion''s affordability.", "B": "It suggests that the narrator suspects there may be something unusual about the mansion.", "C": "It demonstrates the narrator''s extensive knowledge of real estate markets.", "D": "It indicates the narrator''s preference for modern housing over historic properties."}'::jsonb,
'B',
'The narrator is questioning why the mansion is cheap and has been unoccupied, suggesting suspicion about something being wrong with it.',
1,
ARRAY['reading comprehension', 'function questions', 'textual analysis']
),

-- English 1 - Question 2  
('550e8400-e29b-41d4-a716-446655440000', 'english1', 2, 'multiple_choice', 'easy',
'While researching a topic, a student has taken the following notes:

• Marie Curie was born in Poland in 1867
• She moved to Paris in 1891 to study at the Sorbonne
• She discovered the elements polonium (1898) and radium (1902)
• She was the first woman to win a Nobel Prize (Physics, 1903)
• She won a second Nobel Prize in Chemistry in 1911
• She remains the only person to win Nobel Prizes in two different sciences

The student wants to emphasize Marie Curie''s unique achievement in Nobel Prize history. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
'{"A": "Marie Curie, who was born in Poland in 1867, moved to Paris to study at the Sorbonne in 1891.", "B": "Marie Curie discovered two elements: polonium in 1898 and radium in 1902.", "C": "Marie Curie was the first woman to win a Nobel Prize when she won in Physics in 1903.", "D": "Marie Curie remains the only person to win Nobel Prizes in two different sciences, Physics and Chemistry."}'::jsonb,
'D',
'Choice D directly states her unique achievement of being the only person to win Nobel Prizes in two different sciences.',
1,
ARRAY['research skills', 'synthesis', 'effective writing']
),

-- English 1 - Question 3
('550e8400-e29b-41d4-a716-446655440000', 'english1', 3, 'multiple_choice', 'hard',
'The following text is adapted from a 2023 scientific article about coral reef ecosystems.

Recent studies have revealed that coral reefs possess remarkable resilience mechanisms that were previously underestimated by marine biologists. When subjected to thermal stress, certain coral species can expel their symbiotic algae and enter a state of dormancy, during which they reduce metabolic activity by up to 70%. This adaptive response, termed "coral hibernation," allows the organisms to survive temperature fluctuations that would otherwise prove lethal. _______ the discovery has prompted researchers to reconsider conservation strategies that had written off bleached reefs as beyond recovery.

Which choice completes the text with the most logical transition?',
'{"A": "Similarly,", "B": "Consequently,", "C": "Nevertheless,", "D": "For instance,"}'::jsonb,
'B',
'The discovery of coral resilience mechanisms logically leads to (consequently) reconsidering conservation strategies.',
1,
ARRAY['transitions', 'logical reasoning', 'scientific writing']
),

-- ENGLISH MODULE 2 QUESTIONS (Writing & Language)
-- English 2 - Question 1
('550e8400-e29b-41d4-a716-446655440000', 'english2', 1, 'multiple_choice', 'medium',
'Urban planners in Copenhagen have implemented a comprehensive cycling infrastructure that has transformed the city''s transportation landscape. _______ over 40% of residents now commute to work by bicycle, making it one of the most bike-friendly cities in the world.',
'{"A": "Specifically,", "B": "As a result,", "C": "For example,", "D": "In contrast,"}'::jsonb,
'B',
'The cycling infrastructure implementation caused the result of 40% bicycle commuting.',
1,
ARRAY['transitions', 'cause and effect', 'urban planning']
),

-- English 2 - Question 2
('550e8400-e29b-41d4-a716-446655440000', 'english2', 2, 'multiple_choice', 'easy',
'The research team''s findings _______ that renewable energy sources could meet 85% of the country''s power needs by 2035.',
'{"A": "suggests", "B": "suggest", "C": "suggesting", "D": "to suggest"}'::jsonb,
'B',
'The plural subject "findings" requires the plural verb "suggest."',
1,
ARRAY['subject-verb agreement', 'grammar', 'verb forms']
),

-- English 2 - Question 3
('550e8400-e29b-41d4-a716-446655440000', 'english2', 3, 'multiple_choice', 'hard',
'The museum''s new exhibition features artifacts from ancient civilizations_______ including pottery from Mesopotamia, sculptures from Greece, and textiles from Peru.',
'{"A": ":", "B": ",", "C": ";", "D": "—"}'::jsonb,
'B',
'A comma is needed before "including" when it introduces examples.',
1,
ARRAY['punctuation', 'comma usage', 'lists']
),

-- MATH MODULE 1 QUESTIONS (No Calculator)
-- Math 1 - Question 1
('550e8400-e29b-41d4-a716-446655440000', 'math1', 1, 'multiple_choice', 'medium',
'If 3x + 7 = 22, what is the value of 6x + 14?',
'{"A": "30", "B": "44", "C": "15", "D": "22"}'::jsonb,
'B',
'Solve 3x + 7 = 22 to get 3x = 15, so x = 5. Then 6x + 14 = 6(5) + 14 = 30 + 14 = 44. Alternatively, notice that 6x + 14 = 2(3x + 7) = 2(22) = 44.',
1,
ARRAY['linear equations', 'algebraic manipulation']
),

-- Math 1 - Question 2
('550e8400-e29b-41d4-a716-446655440000', 'math1', 2, 'grid_in', 'medium',
'What value of x satisfies the equation 2x + 3 = 3x - 5?',
NULL,
'8',
'Solve: 2x + 3 = 3x - 5. Subtract 2x from both sides: 3 = x - 5. Add 5 to both sides: x = 8.',
1,
ARRAY['linear equations', 'solving for variables']
),

-- Math 1 - Question 3
('550e8400-e29b-41d4-a716-446655440000', 'math1', 3, 'multiple_choice', 'hard',
'If f(x) = x² - 4x + 3, what is the value of f(x) when x = -2?',
'{"A": "15", "B": "11", "C": "3", "D": "-5"}'::jsonb,
'A',
'Substitute x = -2: f(-2) = (-2)² - 4(-2) + 3 = 4 + 8 + 3 = 15.',
1,
ARRAY['function evaluation', 'quadratic functions', 'substitution']
),

-- MATH MODULE 2 QUESTIONS (Calculator Allowed)
-- Math 2 - Question 1
('550e8400-e29b-41d4-a716-446655440000', 'math2', 1, 'multiple_choice', 'medium',
'A survey of 500 students found that 60% play sports, 40% play music, and 25% play both sports and music. How many students play either sports or music (or both)?',
'{"A": "375", "B": "350", "C": "300", "D": "425"}'::jsonb,
'A',
'Using the inclusion-exclusion principle: Sports OR Music = Sports + Music - Both = (60% × 500) + (40% × 500) - (25% × 500) = 300 + 200 - 125 = 375.',
1,
ARRAY['probability', 'set theory', 'data analysis']
),

-- Math 2 - Question 2
('550e8400-e29b-41d4-a716-446655440000', 'math2', 2, 'grid_in', 'hard',
'In a right triangle, one leg has length 5 and the hypotenuse has length 13. What is the length of the other leg?',
NULL,
'12',
'Using the Pythagorean theorem: a² + b² = c². So 5² + b² = 13², which gives 25 + b² = 169, so b² = 144, and b = 12.',
1,
ARRAY['geometry', 'Pythagorean theorem', 'right triangles']
),

-- Math 2 - Question 3
('550e8400-e29b-41d4-a716-446655440000', 'math2', 3, 'multiple_choice', 'hard',
'The function g(x) = 2x³ - 6x² + 4x has how many real zeros?',
'{"A": "0", "B": "1", "C": "2", "D": "3"}'::jsonb,
'D',
'Factor: g(x) = 2x(x² - 3x + 2) = 2x(x - 1)(x - 2). The zeros are x = 0, x = 1, and x = 2, so there are 3 real zeros.',
1,
ARRAY['polynomial functions', 'factoring', 'zeros of functions']
),

-- Additional questions for better testing variety

-- English 1 - Question 4 (Reading Comprehension)
('550e8400-e29b-41d4-a716-446655440000', 'english1', 4, 'multiple_choice', 'easy',
'The following text is from a 2023 article about renewable energy.

Solar panels convert sunlight directly into electricity through photovoltaic cells. Wind turbines harness kinetic energy from moving air to generate power. Both technologies have become increasingly cost-effective, with solar panel costs dropping by 85% over the past decade.

Based on the text, which statement is most accurate?',
'{"A": "Wind turbines are more efficient than solar panels.", "B": "Solar panel costs have decreased significantly in recent years.", "C": "Photovoltaic cells require moving air to function.", "D": "Wind energy costs more than solar energy."}'::jsonb,
'B',
'The text explicitly states that solar panel costs dropped by 85% over the past decade.',
1,
ARRAY['reading comprehension', 'renewable energy', 'data interpretation']
),

-- English 1 - Question 5 (Vocabulary in Context)
('550e8400-e29b-41d4-a716-446655440000', 'english1', 5, 'multiple_choice', 'medium',
'The scientist''s hypothesis was both innovative and plausible, earning widespread recognition from the research community. Her colleagues were particularly impressed by the experiment''s meticulous design and comprehensive data collection.

As used in the text, "meticulous" most nearly means',
'{"A": "careless", "B": "hurried", "C": "detailed", "D": "expensive"}'::jsonb,
'C',
'In context, "meticulous design" refers to careful, detailed attention to the experiment''s planning.',
1,
ARRAY['vocabulary', 'context clues', 'scientific writing']
),

-- English 2 - Question 4 (Grammar)
('550e8400-e29b-41d4-a716-446655440000', 'english2', 4, 'multiple_choice', 'easy',
'The students, _______ had been studying for weeks, performed exceptionally well on the exam.',
'{"A": "who", "B": "whom", "C": "which", "D": "that"}'::jsonb,
'A',
'"Who" is correct because it functions as the subject of the clause "had been studying for weeks."',
1,
ARRAY['relative pronouns', 'grammar', 'sentence structure']
),

-- English 2 - Question 5 (Style and Tone)
('550e8400-e29b-41d4-a716-446655440000', 'english2', 5, 'multiple_choice', 'hard',
'The author wants to maintain a formal, academic tone throughout the research paper. Which choice best accomplishes this goal?',
'{"A": "The data shows that our hypothesis was totally wrong.", "B": "Our findings contradict the initial hypothesis.", "C": "We were way off with our guess about the results.", "D": "The experiment basically proved us wrong."}'::jsonb,
'B',
'Choice B maintains formal, academic language appropriate for a research paper.',
1,
ARRAY['tone', 'academic writing', 'style']
),

-- Math 1 - Question 4 (Algebra)
('550e8400-e29b-41d4-a716-446655440000', 'math1', 4, 'multiple_choice', 'easy',
'If y = 3x - 2 and x = 4, what is the value of y?',
'{"A": "10", "B": "12", "C": "14", "D": "16"}'::jsonb,
'A',
'Substitute x = 4 into y = 3x - 2: y = 3(4) - 2 = 12 - 2 = 10.',
1,
ARRAY['substitution', 'linear equations', 'basic algebra']
),

-- Math 1 - Question 5 (Fractions)
('550e8400-e29b-41d4-a716-446655440000', 'math1', 5, 'grid_in', 'easy',
'What is 2/3 + 1/4? Express your answer as a fraction in lowest terms.',
'null',
'11/12',
'Find common denominator: 2/3 = 8/12, 1/4 = 3/12. So 8/12 + 3/12 = 11/12.',
1,
ARRAY['fractions', 'addition', 'common denominators']
),

-- Math 2 - Question 4 (Statistics)
('550e8400-e29b-41d4-a716-446655440000', 'math2', 4, 'multiple_choice', 'medium',
'A data set has a mean of 15 and a standard deviation of 3. Approximately what percentage of the data falls within 2 standard deviations of the mean?',
'{"A": "68%", "B": "95%", "C": "99.7%", "D": "50%"}'::jsonb,
'B',
'According to the empirical rule (68-95-99.7 rule), approximately 95% of data falls within 2 standard deviations of the mean.',
1,
ARRAY['statistics', 'normal distribution', 'empirical rule']
),

-- Math 2 - Question 5 (Complex Numbers)
('550e8400-e29b-41d4-a716-446655440000', 'math2', 5, 'grid_in', 'hard',
'If i is the imaginary unit, what is the value of i² + i⁴?',
'null',
'0',
'i² = -1 and i⁴ = (i²)² = (-1)² = 1. Therefore, i² + i⁴ = -1 + 1 = 0.',
1,
ARRAY['complex numbers', 'imaginary unit', 'exponents']
);