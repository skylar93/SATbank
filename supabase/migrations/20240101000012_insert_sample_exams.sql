-- Insert sample exams for testing
INSERT INTO exams (id, title, description, is_mock_exam, is_active, total_questions, time_limits) VALUES
  (
    uuid_generate_v4(),
    'SAT Practice Test 1',
    'Official College Board SAT Practice Test 1 - Full length digital SAT simulation',
    true,
    true,
    98,
    '{"english1": 32, "english2": 32, "math1": 35, "math2": 35}'
  ),
  (
    uuid_generate_v4(),
    'SAT Practice Test 2', 
    'Official College Board SAT Practice Test 2 - Complete digital SAT experience',
    true,
    true,
    98,
    '{"english1": 32, "english2": 32, "math1": 35, "math2": 35}'
  ),
  (
    uuid_generate_v4(),
    'Math Focus Practice',
    'Mathematics-focused practice session covering algebra, geometry, and data analysis',
    false,
    true,
    44,
    '{"math1": 35, "math2": 35}'
  ),
  (
    uuid_generate_v4(),
    'English Reading & Writing',
    'Comprehensive reading comprehension and grammar practice',
    false,
    true,
    54,
    '{"english1": 32, "english2": 32}'
  );