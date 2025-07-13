-- Row Level Security (RLS) Policies for SAT Mock Exam & Problem Bank
-- Ensures proper access control for students and admins

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_answers ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- USER_PROFILES policies
-- Users can read their own profile, admins can read all
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
    FOR SELECT USING (is_admin(auth.uid()));

-- Users can update their own profile, admins can update any
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON user_profiles
    FOR UPDATE USING (is_admin(auth.uid()));

-- Only authenticated users can insert profiles (during signup)
CREATE POLICY "Authenticated users can create profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Admins can delete profiles
CREATE POLICY "Admins can delete profiles" ON user_profiles
    FOR DELETE USING (is_admin(auth.uid()));

-- EXAMS policies
-- All authenticated users can read active exams
CREATE POLICY "Users can view active exams" ON exams
    FOR SELECT USING (is_active = true);

-- Admins can view all exams
CREATE POLICY "Admins can view all exams" ON exams
    FOR SELECT USING (is_admin(auth.uid()));

-- Only admins can create, update, delete exams
CREATE POLICY "Admins can create exams" ON exams
    FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update exams" ON exams
    FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete exams" ON exams
    FOR DELETE USING (is_admin(auth.uid()));

-- QUESTIONS policies
-- Users can read questions for active exams
CREATE POLICY "Users can view questions for active exams" ON questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM exams 
            WHERE exams.id = questions.exam_id 
            AND exams.is_active = true
        )
    );

-- Admins can view all questions
CREATE POLICY "Admins can view all questions" ON questions
    FOR SELECT USING (is_admin(auth.uid()));

-- Only admins can create, update, delete questions
CREATE POLICY "Admins can create questions" ON questions
    FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update questions" ON questions
    FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete questions" ON questions
    FOR DELETE USING (is_admin(auth.uid()));

-- TEST_ATTEMPTS policies
-- Users can only see their own test attempts
CREATE POLICY "Users can view own test attempts" ON test_attempts
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all test attempts
CREATE POLICY "Admins can view all test attempts" ON test_attempts
    FOR SELECT USING (is_admin(auth.uid()));

-- Users can create their own test attempts
CREATE POLICY "Users can create own test attempts" ON test_attempts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own test attempts
CREATE POLICY "Users can update own test attempts" ON test_attempts
    FOR UPDATE USING (auth.uid() = user_id);

-- Admins can update any test attempt
CREATE POLICY "Admins can update any test attempt" ON test_attempts
    FOR UPDATE USING (is_admin(auth.uid()));

-- Admins can delete test attempts
CREATE POLICY "Admins can delete test attempts" ON test_attempts
    FOR DELETE USING (is_admin(auth.uid()));

-- USER_ANSWERS policies
-- Users can view their own answers
CREATE POLICY "Users can view own answers" ON user_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM test_attempts 
            WHERE test_attempts.id = user_answers.attempt_id 
            AND test_attempts.user_id = auth.uid()
        )
    );

-- Admins can view all answers
CREATE POLICY "Admins can view all answers" ON user_answers
    FOR SELECT USING (is_admin(auth.uid()));

-- Users can create answers for their own attempts
CREATE POLICY "Users can create own answers" ON user_answers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM test_attempts 
            WHERE test_attempts.id = user_answers.attempt_id 
            AND test_attempts.user_id = auth.uid()
        )
    );

-- Users can update their own answers (before submission)
CREATE POLICY "Users can update own answers" ON user_answers
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM test_attempts 
            WHERE test_attempts.id = user_answers.attempt_id 
            AND test_attempts.user_id = auth.uid()
            AND test_attempts.status = 'in_progress'
        )
    );

-- Admins can update any answer
CREATE POLICY "Admins can update any answer" ON user_answers
    FOR UPDATE USING (is_admin(auth.uid()));

-- Admins can delete answers
CREATE POLICY "Admins can delete answers" ON user_answers
    FOR DELETE USING (is_admin(auth.uid()));

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic user profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();