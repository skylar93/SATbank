-- Migration File: 20240101000015_v2_scoring_engine_setup.sql
-- v2.0 Scoring Engine Database Schema Setup
-- Adds necessary columns to support admin-directed scoring curve assignments

-- Step 1: Add columns to the 'exams' table to link to scoring curves.
-- This allows admins to assign a specific curve to each exam.
ALTER TABLE public.exams
ADD COLUMN english_scoring_curve_id INT REFERENCES public.scoring_curves(id),
ADD COLUMN math_scoring_curve_id INT REFERENCES public.scoring_curves(id);

COMMENT ON COLUMN public.exams.english_scoring_curve_id IS 'FK to the scoring curve for Reading & Writing section';
COMMENT ON COLUMN public.exams.math_scoring_curve_id IS 'FK to the scoring curve for Math section';

-- Step 2: Add a column to the 'test_attempts' table to store the final scaled scores.
-- This keeps the new scaled scores separate from the old raw scores (module_scores).
ALTER TABLE public.test_attempts
ADD COLUMN final_scores JSONB;

COMMENT ON COLUMN public.test_attempts.final_scores IS 'Stores the final calculated scaled scores, e.g., {"overall": 1450, "english": 720, "math": 730}';