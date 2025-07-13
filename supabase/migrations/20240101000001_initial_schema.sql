-- Initial Database Schema for SAT Mock Exam & Problem Bank
-- Supports 4 modules: English 1,2 + Math 1,2
-- User roles: student/admin
-- Detailed answer tracking

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE module_type AS ENUM ('english1', 'english2', 'math1', 'math2');
CREATE TYPE question_type AS ENUM ('multiple_choice', 'grid_in', 'essay');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE user_role AS ENUM ('student', 'admin');
CREATE TYPE exam_status AS ENUM ('not_started', 'in_progress', 'completed', 'expired');

-- Create user_profiles table (extends auth.users)
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'student',
    grade_level INTEGER CHECK (grade_level >= 9 AND grade_level <= 12),
    target_score INTEGER CHECK (target_score >= 400 AND target_score <= 1600),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exams table
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_mock_exam BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    total_questions INTEGER NOT NULL DEFAULT 154, -- Full SAT: 154 questions
    time_limits JSONB NOT NULL DEFAULT '{
        "english1": 64,
        "english2": 35,
        "math1": 35,
        "math2": 55
    }', -- Time limits in minutes
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create questions table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    module_type module_type NOT NULL,
    question_number INTEGER NOT NULL,
    question_type question_type NOT NULL,
    difficulty_level difficulty_level DEFAULT 'medium',
    question_text TEXT NOT NULL,
    question_image_url VARCHAR(500),
    options JSONB, -- For multiple choice: {"A": "text", "B": "text", etc.}
    correct_answer VARCHAR(10) NOT NULL, -- A, B, C, D for MC; numeric for grid-in
    explanation TEXT,
    points INTEGER DEFAULT 1,
    topic_tags TEXT[], -- Array of topic tags
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique question numbers per exam and module
    UNIQUE(exam_id, module_type, question_number)
);

-- Create test_attempts table
CREATE TABLE test_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    status exam_status DEFAULT 'not_started',
    current_module module_type,
    current_question_number INTEGER DEFAULT 1,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    time_spent JSONB DEFAULT '{}', -- Track time spent per module
    total_score INTEGER DEFAULT 0,
    module_scores JSONB DEFAULT '{}', -- Scores per module
    is_practice_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_answers table
CREATE TABLE user_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID REFERENCES test_attempts(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    user_answer VARCHAR(10), -- A, B, C, D for MC; numeric for grid-in
    is_correct BOOLEAN,
    time_spent_seconds INTEGER DEFAULT 0,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one answer per question per attempt
    UNIQUE(attempt_id, question_id)
);

-- Create indexes for better performance
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_questions_exam_module ON questions(exam_id, module_type);
CREATE INDEX idx_questions_difficulty ON questions(difficulty_level);
CREATE INDEX idx_test_attempts_user_status ON test_attempts(user_id, status);
CREATE INDEX idx_test_attempts_exam ON test_attempts(exam_id);
CREATE INDEX idx_user_answers_attempt ON user_answers(attempt_id);
CREATE INDEX idx_user_answers_question ON user_answers(question_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON exams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_attempts_updated_at BEFORE UPDATE ON test_attempts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();