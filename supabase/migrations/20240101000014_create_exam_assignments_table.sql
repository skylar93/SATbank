-- Create exam_assignments table
-- This table manages which students are assigned which exams

CREATE TABLE exam_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one assignment per student per exam
    UNIQUE(exam_id, student_id)
);

-- Create indexes for better performance
CREATE INDEX idx_exam_assignments_exam ON exam_assignments(exam_id);
CREATE INDEX idx_exam_assignments_student ON exam_assignments(student_id);
CREATE INDEX idx_exam_assignments_assigned_by ON exam_assignments(assigned_by);
CREATE INDEX idx_exam_assignments_active ON exam_assignments(is_active);

-- Apply updated_at trigger
CREATE TRIGGER update_exam_assignments_updated_at BEFORE UPDATE ON exam_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create foreign key relationship with user_profiles for easier querying
-- This allows Supabase to understand the relationship for joins
ALTER TABLE exam_assignments 
ADD CONSTRAINT fk_exam_assignments_student 
FOREIGN KEY (student_id) REFERENCES user_profiles(id) ON DELETE CASCADE;