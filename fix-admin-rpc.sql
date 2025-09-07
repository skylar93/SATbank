-- Fix get_admin_report_attempts function with proper security

CREATE OR REPLACE FUNCTION "public"."get_admin_report_attempts"() 
RETURNS TABLE("attempt_id" "uuid", "completed_at" timestamp with time zone, "duration_seconds" bigint, "final_scores" "jsonb", "student_id" "uuid", "student_full_name" character varying, "student_email" character varying, "exam_id" "uuid", "exam_title" character varying)
LANGUAGE "plpgsql" 
SECURITY DEFINER
AS $$
DECLARE
  current_user_role TEXT;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get current user's role
  SELECT role INTO current_user_role 
  FROM public.user_profiles 
  WHERE id = auth.uid();
  
  -- Check if user is admin
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

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

-- Set permissions
ALTER FUNCTION "public"."get_admin_report_attempts"() OWNER TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."get_admin_report_attempts"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_admin_report_attempts"() TO "anon";
GRANT EXECUTE ON FUNCTION "public"."get_admin_report_attempts"() TO "service_role";