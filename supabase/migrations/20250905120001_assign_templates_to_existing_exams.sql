-- Migration: Assign Templates to Existing Exams (Phase 1c)
-- This migration categorizes our existing 15 exams using the templates defined in Phase 1b

-- Full SAT Practice Tests (11 exams)
-- These are complete SAT exams with all 4 modules
UPDATE public.exams 
SET template_id = 'full_sat'
WHERE title IN (
  'Mock Test',
  'SAT 2024 DEC', 
  'SAT 2024 OCT C',
  'SAT 2025 MAY B',
  'SAT 2024 AUG USA B',
  'Full Practice Test 1',
  'SAT 2023 JUN INT',
  'SAT 2024 JUNE USA', 
  'SAT 2024 NOV USB',
  'SAT 2024 MAY INT B',
  'SAT Practice Test - Module 1'
);

-- Single Module Practice (1 exam)
-- This is practice focused on individual modules
UPDATE public.exams
SET template_id = 'single_module' 
WHERE title = 'English Module Practice 13';

-- Custom Assignments (3 exams)
-- These are specialized practice sets or mistake collections
UPDATE public.exams
SET template_id = 'custom'
WHERE title IN (
  'Math Practice Module 1',
  'Mistake',
  'Module 1 August 2023 (Auto Import)'
);

-- Verify the assignments
SELECT 
  template_id,
  COUNT(*) as exam_count,
  array_agg(title ORDER BY title) as exam_titles
FROM public.exams 
GROUP BY template_id
ORDER BY 
  CASE template_id
    WHEN 'full_sat' THEN 1
    WHEN 'single_module' THEN 2  
    WHEN 'custom' THEN 3
    WHEN null THEN 4
  END;

-- Final verification: ensure all exams have templates
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ All exams have templates assigned'
    ELSE '⚠️  ' || COUNT(*) || ' exams still need template assignment'
  END as status
FROM public.exams 
WHERE template_id IS NULL;