-- Populate module_composition field for existing exams
-- This migration categorizes existing exams as module sources and sets their composition

-- Step 1: Mark dedicated single modules as module sources
UPDATE public.exams
SET is_module_source = true
WHERE 
  id IN (
    '123e4567-e89b-12d3-a456-426614174000', -- Math Practice Module 1 (Math1)
    '09eee297-8674-478c-921b-122a9d7f4452', -- Module 1 August 2023 (English1)  
    '36380256-894d-43ea-aa98-4afc56efb964'  -- English Module Practice 13 (English1+2)
  );

-- Step 2: Populate module_composition for module sources

-- Math Practice Module 1 - contains Math1 module
UPDATE public.exams
SET module_composition = '{"math1": true}'::jsonb
WHERE id = '123e4567-e89b-12d3-a456-426614174000';

-- Module 1 August 2023 - contains English1 module  
UPDATE public.exams
SET module_composition = '{"english1": true}'::jsonb
WHERE id = '09eee297-8674-478c-921b-122a9d7f4452';

-- English Module Practice 13 - contains both English1 and English2
UPDATE public.exams
SET module_composition = '{"english1": true, "english2": true}'::jsonb
WHERE id = '36380256-894d-43ea-aa98-4afc56efb964';

-- Step 3: Mark all complete Full SAT tests as potential module sources
-- These can serve as sources for any of the 4 modules
UPDATE public.exams
SET 
  is_module_source = true,
  module_composition = '{"english1": true, "english2": true, "math1": true, "math2": true}'::jsonb
WHERE 
  template_id = 'full_sat'
  AND id IN (
    '6f4eb255-3d1a-4e4c-90f3-99364b63c91a', -- SAT 2024 DEC
    'f47ac10b-58cc-4372-a567-0e02b2c3d479', -- SAT 2024 OCT C
    '4796f645-9975-4872-b466-e3b5248dcc6c', -- SAT 2025 MAY B
    'f8b2d4c1-9a3e-4f5c-b7d8-1e2a3b4c5d6e', -- SAT 2024 AUG USA B
    '8d091615-1b91-40a5-bc3a-bd2c44618b02', -- Full Practice Test 1
    '550e6881-8930-4d5f-9c7a-1234567890ab', -- SAT 2024 JUNE USA
    'b2c3d4e5-6789-abcd-ef01-23456789abcd'  -- SAT 2024 NOV USB
  );

-- Step 4: Handle the 97-question SAT 2023 JUN INT (complete but slightly different)
-- Note: This exam has a unique structure (97 questions vs standard 98)
-- Will be handled separately if/when we find its actual ID in the database

-- Step 5: Handle incomplete/test exams - keep as final exams, not sources
-- SAT 2024 MAY INT B (missing Math1) - keep as final exam with its limitations
-- Mock Test and SAT Practice Test - Module 1 remain as final demo/test exams

-- Step 6: Update template assignments for better categorization
UPDATE public.exams
SET template_id = 'math_only'
WHERE id = '123e4567-e89b-12d3-a456-426614174000'; -- Math Practice Module 1

UPDATE public.exams  
SET template_id = 'english_only'
WHERE id = '09eee297-8674-478c-921b-122a9d7f4452'; -- Module 1 August 2023

-- Keep English Module Practice 13 as single_module since it has both English modules

-- Add comments for clarity
COMMENT ON COLUMN public.exams.module_composition IS 'JSON object indicating which SAT modules this exam contains. Used for Smart Exam Builder to find compatible module sources. Keys: english1, english2, math1, math2. Values: true if module is available.';

-- Verify the migration results
DO $$
BEGIN
    RAISE NOTICE 'Migration completed. Module sources created: %', 
        (SELECT COUNT(*) FROM public.exams WHERE is_module_source = true);
    RAISE NOTICE 'Exams with populated module_composition: %',
        (SELECT COUNT(*) FROM public.exams WHERE module_composition != '{}'::jsonb);
END $$;