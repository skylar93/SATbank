-- Migration: Add template information to get_admin_exams_list function
-- Purpose: Include template_id and is_custom_assignment for template deletion UI

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_admin_exams_list();

-- Create the function with template information
CREATE OR REPLACE FUNCTION public.get_admin_exams_list()
RETURNS TABLE (
    id uuid,
    title character varying(255),
    description text,
    created_at timestamptz,
    is_active boolean,
    total_questions integer,
    english_curve_id int,
    math_curve_id int,
    english_curve_name text,
    math_curve_name text,
    latest_attempt_visibility boolean,
    latest_attempt_visible_after timestamptz,
    total_attempts_count bigint,
    template_id text,              -- Added for template identification
    is_custom_assignment boolean,  -- Added for custom assignment identification
    exam_type text                 -- Added for UI display (original/template/custom)
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
      e.id,
      e.title,
      e.description,
      e.created_at,
      e.is_active,
      e.total_questions,
      e.english_scoring_curve_id as english_curve_id,
      e.math_scoring_curve_id as math_curve_id,
      ec.curve_name as english_curve_name,
      mc.curve_name as math_curve_name,
      latest_attempt.answers_visible as latest_attempt_visibility,
      latest_attempt.answers_visible_after as latest_attempt_visible_after,
      COALESCE(attempt_counts.total_attempts, 0) as total_attempts_count,
      e.template_id,
      e.is_custom_assignment,
      CASE 
          WHEN e.template_id IS NOT NULL THEN 'template'
          WHEN e.is_custom_assignment = true THEN 'custom'
          ELSE 'original'
      END as exam_type
  FROM
      public.exams e
  LEFT JOIN
      public.scoring_curves ec ON e.english_scoring_curve_id = ec.id
  LEFT JOIN
      public.scoring_curves mc ON e.math_scoring_curve_id = mc.id
  -- This LATERAL JOIN efficiently finds the latest attempt for each exam
  LEFT JOIN LATERAL (
      SELECT
          ta.answers_visible,
          ta.answers_visible_after
      FROM
          public.test_attempts ta
      WHERE
          ta.exam_id = e.id
      ORDER BY
          ta.created_at DESC
      LIMIT 1
  ) latest_attempt ON true
  -- Get total attempt count for each exam
  LEFT JOIN LATERAL (
      SELECT
          COUNT(*) as total_attempts
      FROM
          public.test_attempts ta
      WHERE
          ta.exam_id = e.id
  ) attempt_counts ON true
  ORDER BY
      e.created_at DESC;
END;
$$ LANGUAGE plpgsql;