-- =============================================================================
-- Phase 1: Exam Templates System - Manual Migration SQL
-- Execute this in Supabase Dashboard > SQL Editor
-- =============================================================================

-- Step 1: Create exam_templates table
-- This defines the "blueprints" for different exam types
CREATE TABLE public.exam_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    -- Defines how modules are grouped for scoring
    -- Example: {"english": ["english1", "english2"], "math": ["math1", "math2"]}
    scoring_groups JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Add template-related columns to existing exams table
-- These columns will link exams to templates and store their composition
ALTER TABLE public.exams 
ADD COLUMN template_id TEXT,
ADD COLUMN module_composition JSONB DEFAULT '{}'::jsonb;

-- Step 3: Create foreign key constraint
-- Links exams to their templates
ALTER TABLE public.exams 
ADD CONSTRAINT fk_exams_template_id 
FOREIGN KEY (template_id) REFERENCES public.exam_templates(id);

-- Step 4: Create indexes for better performance
CREATE INDEX idx_exams_template_id ON public.exams(template_id);
CREATE INDEX idx_exam_templates_created_at ON public.exam_templates(created_at);

-- Step 5: Enable Row Level Security on new table
ALTER TABLE public.exam_templates ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for exam_templates
-- Allow everyone to view templates, only admins to manage
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

-- Step 7: Add helpful comments for documentation
COMMENT ON TABLE public.exam_templates IS 'Defines exam composition templates (Full SAT, English Only, etc.)';
COMMENT ON COLUMN public.exam_templates.scoring_groups IS 'Defines how modules are grouped for scoring: {"english": ["english1", "english2"]}';
COMMENT ON COLUMN public.exams.template_id IS 'Links exam to its template definition';
COMMENT ON COLUMN public.exams.module_composition IS 'Maps template modules to actual imported content: {"english1": "source_exam_id"}';

-- =============================================================================
-- Migration Complete!
-- 
-- What this adds:
-- ✅ exam_templates table (new)
-- ✅ exams.template_id column (new) 
-- ✅ exams.module_composition column (new)
-- ✅ Foreign key constraints and indexes
-- ✅ Row Level Security policies
-- 
-- What remains unchanged:
-- ✅ All existing exams data
-- ✅ All existing questions data  
-- ✅ All test_attempts and user_answers
-- ✅ All existing functionality
-- =============================================================================