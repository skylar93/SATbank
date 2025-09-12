-- Migration: Seed Exam Templates (Phase 1b)
-- This migration populates the exam_templates table with our core business blueprints

INSERT INTO public.exam_templates (id, name, description, scoring_groups) VALUES
(
  'full_sat',
  'Full SAT Practice Test',
  'A standard, 4-module SAT test with combined English and Math scoring.',
  '{ "english": ["english1", "english2"], "math": ["math1", "math2"] }'::jsonb
),
(
  'english_only',
  'English Only Section',
  'An exam consisting of only the two English modules with combined English scoring.',
  '{ "english": ["english1", "english2"] }'::jsonb
),
(
  'math_only',
  'Math Only Section', 
  'An exam consisting of only the two Math modules with combined Math scoring.',
  '{ "math": ["math1", "math2"] }'::jsonb
),
(
  'single_module',
  'Single Module Practice',
  'A practice test focused on a single module with individual scoring.',
  '{}'::jsonb -- No combined scoring for single modules
),
(
  'custom',
  'Custom Assignment',
  'A custom set of questions, often from student mistakes or specific practice needs.',
  '{}'::jsonb -- Scoring handled individually per question
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exam_templates_id ON public.exam_templates(id);

-- Verify the insert
SELECT 
  id,
  name,
  description,
  scoring_groups
FROM public.exam_templates
ORDER BY 
  CASE id
    WHEN 'full_sat' THEN 1
    WHEN 'english_only' THEN 2
    WHEN 'math_only' THEN 3
    WHEN 'single_module' THEN 4
    WHEN 'custom' THEN 5
  END;