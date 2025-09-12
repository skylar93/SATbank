-- Restore original get_admin_report_attempts function (without authentication check)

CREATE OR REPLACE FUNCTION "public"."get_admin_report_attempts"() 
RETURNS TABLE("attempt_id" "uuid", "completed_at" timestamp with time zone, "duration_seconds" bigint, "final_scores" "jsonb", "student_id" "uuid", "student_full_name" character varying, "student_email" character varying, "exam_id" "uuid", "exam_title" character varying)
LANGUAGE "plpgsql"
AS $$
BEGIN
  RETURN QUERY
  SELECT
      ta.id as attempt_id,
      ta.completed_at,
      EXTRACT(EPOCH FROM (ta.completed_at - ta.started_at))::bigint as duration_seconds,
      ta.final_scores,
      up.id as student_id,
      up.full_name as student_full_name,
      up.email as student_email,
      e.id as exam_id,
      e.title as exam_title
  FROM
      public.test_attempts ta
  JOIN
      public.user_profiles up ON ta.user_id = up.id
  JOIN
      public.exams e ON ta.exam_id = e.id
  WHERE
      ta.status = 'completed'
  ORDER BY
      ta.completed_at DESC;
END;
$$;