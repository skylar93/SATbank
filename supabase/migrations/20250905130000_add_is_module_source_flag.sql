-- Add is_module_source flag to distinguish between module sources and final exams
ALTER TABLE public.exams
ADD COLUMN IF NOT EXISTS is_module_source BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.exams.is_module_source IS 'True if this record represents an imported module source, not a final student-facing exam.';