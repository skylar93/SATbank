-- Phase 1: Create Exam Templates System
-- This migration adds template-based exam composition support
-- while maintaining full backward compatibility

-- Step 1: Create exam_templates table
CREATE TABLE public.exam_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    -- Defines which modules are grouped together for scoring
    -- Example: {"english": ["english1", "english2"], "math": ["math1", "math2"]}
    scoring_groups JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add template-related columns to exams table
ALTER TABLE public.exams 
ADD COLUMN template_id TEXT REFERENCES public.exam_templates(id),
ADD COLUMN module_composition JSONB DEFAULT '{}'::jsonb;

-- Step 3: Add helpful comments
COMMENT ON TABLE public.exam_templates IS 'Defines exam composition templates (Full SAT, English Only, etc.)';
COMMENT ON COLUMN public.exam_templates.scoring_groups IS 'Defines how modules are grouped for scoring: {"english": ["english1", "english2"]}';
COMMENT ON COLUMN public.exams.template_id IS 'Links exam to its template definition';
COMMENT ON COLUMN public.exams.module_composition IS 'Maps template modules to actual imported content: {"english1": "source_exam_id"}';

-- Step 4: Create indexes for performance
CREATE INDEX idx_exams_template_id ON public.exams(template_id);
CREATE INDEX idx_exam_templates_created_at ON public.exam_templates(created_at);

-- Step 5: Enable RLS on new table
ALTER TABLE public.exam_templates ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for exam_templates
CREATE POLICY "Anyone can view exam templates" ON public.exam_templates
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage exam templates" ON public.exam_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );