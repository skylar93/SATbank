-- Insert sample student users for testing assignments
-- These will be test students that can be assigned exams

INSERT INTO user_profiles (
    id,
    email,
    full_name,
    role,
    grade_level
) VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'student1@test.com',
        'Alice Johnson',
        'student',
        11
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'student2@test.com', 
        'Bob Smith',
        'student',
        12
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        'student3@test.com',
        'Carol Davis',
        'student',
        11
    ),
    (
        '44444444-4444-4444-4444-444444444444',
        'student4@test.com',
        'David Wilson',
        'student',
        12
    ),
    (
        '55555555-5555-5555-5555-555555555555',
        'student5@test.com',
        'Emma Brown',
        'student',
        10
    )
ON CONFLICT (id) DO NOTHING;