-- Migration File: 20250905140000_prepare_for_html_migration.sql
-- Phase 1 HTML Migration: Prepare database for safe markdown-to-html conversion
-- This migration adds HTML columns and renames existing markdown columns as backups

BEGIN;

-- Step 1: Add new columns for HTML content
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question_html TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS options_html JSONB;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS explanation_html TEXT;

-- Step 2: Rename old markdown columns to act as a backup
-- This is our primary safety net - original data will be preserved
ALTER TABLE public.questions RENAME COLUMN question_text TO question_markdown_backup;
ALTER TABLE public.questions RENAME COLUMN options TO options_markdown_backup;
ALTER TABLE public.questions RENAME COLUMN explanation TO explanation_markdown_backup;

-- Step 3: Add new columns with the original names for backward compatibility
-- This allows existing code to continue working unchanged
ALTER TABLE public.questions ADD COLUMN question_text TEXT;
ALTER TABLE public.questions ADD COLUMN options JSONB;
ALTER TABLE public.questions ADD COLUMN explanation TEXT;

-- Step 4: Initially populate the new columns with the same data as backup columns
-- This ensures no functionality is lost during the transition
UPDATE public.questions SET 
    question_text = question_markdown_backup,
    options = options_markdown_backup,
    explanation = explanation_markdown_backup;

-- Step 5: Add indexes on the new HTML columns for performance
CREATE INDEX IF NOT EXISTS idx_questions_question_html ON public.questions USING gin(to_tsvector('english', question_html)) WHERE question_html IS NOT NULL;

-- Step 6: Add a migration status column to track conversion progress
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS html_migration_status TEXT DEFAULT 'pending' CHECK (html_migration_status IN ('pending', 'converted', 'failed'));
CREATE INDEX IF NOT EXISTS idx_questions_migration_status ON public.questions(html_migration_status);

COMMIT;