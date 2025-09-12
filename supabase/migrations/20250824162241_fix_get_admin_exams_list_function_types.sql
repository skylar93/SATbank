-- Migration: Fix get_admin_exams_list function type mismatches
-- Purpose: Align function return types with actual database column types
-- Fixes: Column type mismatch error in get_admin_exams_list function

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.get_admin_exams_list();

-- Create the function with correct types
CREATE OR REPLACE FUNCTION public.get_admin_exams_list()
RETURNS TABLE (
    id uuid,
    title character varying(255),  -- Changed from text to character varying(255)
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
    total_attempts_count bigint
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
      COALESCE(attempt_counts.total_attempts, 0) as total_attempts_count
  FROM
      public.exams e
  LEFT JOIN
      public.scoring_curves ec ON e.english_scoring_curve_id = ec.id
  LEFT JOIN
      public.scoring_curves mc ON e.math_scoring_curve_id = mc.id
  -- This LATERAL JOIN efficiently finds the latest attempt for each exam
  -- without causing an N+1 query problem.
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