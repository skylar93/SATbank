


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."difficulty_level" AS ENUM (
    'easy',
    'medium',
    'hard'
);


ALTER TYPE "public"."difficulty_level" OWNER TO "postgres";


CREATE TYPE "public"."exam_status" AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'expired'
);


ALTER TYPE "public"."exam_status" OWNER TO "postgres";


CREATE TYPE "public"."mistake_status" AS ENUM (
    'unmastered',
    'mastered'
);


ALTER TYPE "public"."mistake_status" OWNER TO "postgres";


CREATE TYPE "public"."module_type" AS ENUM (
    'english1',
    'english2',
    'math1',
    'math2'
);


ALTER TYPE "public"."module_type" OWNER TO "postgres";


CREATE TYPE "public"."question_type" AS ENUM (
    'multiple_choice',
    'grid_in',
    'essay'
);


ALTER TYPE "public"."question_type" OWNER TO "postgres";


CREATE TYPE "public"."quiz_result_input" AS (
	"entry_id" bigint,
	"was_correct" boolean
);


ALTER TYPE "public"."quiz_result_input" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'student',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_update_vocab_progress"("p_user_id" "uuid", "results" "public"."quiz_result_input"[], "p_mastery_max" integer DEFAULT 5, "p_mastery_min" integer DEFAULT 0, "p_interval_multiplier" double precision DEFAULT 2.0, "p_incorrect_reset_interval" integer DEFAULT 1, "p_incorrect_next_review_minutes" integer DEFAULT 10, "p_max_review_interval_days" integer DEFAULT 365) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result_record public.quiz_result_input;
  current_entry RECORD;
  new_mastery_level INT;
  new_review_interval INT;
  next_review_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Process each quiz result
  FOREACH result_record IN ARRAY results
  LOOP
    -- Get current entry data with row-level security
    SELECT mastery_level, review_interval
    INTO current_entry
    FROM vocab_entries
    WHERE id = result_record.entry_id 
      AND user_id = p_user_id;
    
    -- Skip if entry doesn't exist or doesn't belong to user
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    
    -- Calculate new values based on SRS algorithm
    IF result_record.was_correct THEN
      -- Correct answer: increase mastery level and multiply interval
      new_mastery_level := LEAST(p_mastery_max, current_entry.mastery_level + 1);
      new_review_interval := LEAST(
        p_max_review_interval_days,
        (current_entry.review_interval * p_interval_multiplier)::INT
      );
      next_review_timestamp := NOW() + (new_review_interval || ' days')::INTERVAL;
    ELSE
      -- Incorrect answer: decrease mastery level and reset interval
      new_mastery_level := GREATEST(p_mastery_min, current_entry.mastery_level - 1);
      new_review_interval := p_incorrect_reset_interval;
      -- For incorrect answers, next review is much sooner (within the same session)
      next_review_timestamp := NOW() + (p_incorrect_next_review_minutes || ' minutes')::INTERVAL;
    END IF;
    
    -- Update the entry with new SRS values
    UPDATE vocab_entries
    SET 
      mastery_level = new_mastery_level,
      review_interval = new_review_interval,
      next_review_date = next_review_timestamp,
      last_reviewed_at = NOW()
    WHERE id = result_record.entry_id 
      AND user_id = p_user_id;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."bulk_update_vocab_progress"("p_user_id" "uuid", "results" "public"."quiz_result_input"[], "p_mastery_max" integer, "p_mastery_min" integer, "p_interval_multiplier" double precision, "p_incorrect_reset_interval" integer, "p_incorrect_next_review_minutes" integer, "p_max_review_interval_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."bulk_update_vocab_progress"("p_user_id" "uuid", "results" "public"."quiz_result_input"[], "p_mastery_max" integer, "p_mastery_min" integer, "p_interval_multiplier" double precision, "p_incorrect_reset_interval" integer, "p_incorrect_next_review_minutes" integer, "p_max_review_interval_days" integer) IS 'Bulk update vocabulary progress using Spaced Repetition System algorithm. 
Accepts multiple quiz results and SRS configuration parameters for flexible tuning.';



CREATE OR REPLACE FUNCTION "public"."check_user_auth_status"() RETURNS TABLE("property" "text", "value" "text", "is_valid" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_uid UUID;
    user_email TEXT;
    profile_exists BOOLEAN;
    profile_role TEXT;
BEGIN
    -- Get auth info
    current_uid := auth.uid();
    user_email := auth.email();
    
    -- Check profile
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = current_uid) INTO profile_exists;
    
    IF profile_exists THEN
        SELECT role FROM user_profiles WHERE id = current_uid INTO profile_role;
    END IF;
    
    RETURN QUERY VALUES 
        ('auth_uid', COALESCE(current_uid::TEXT, 'NULL'), current_uid IS NOT NULL),
        ('auth_email', COALESCE(user_email, 'NULL'), user_email IS NOT NULL),
        ('profile_exists', profile_exists::TEXT, profile_exists),
        ('profile_role', COALESCE(profile_role, 'NULL'), profile_role IS NOT NULL);
END;
$$;


ALTER FUNCTION "public"."check_user_auth_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_emergency_bypass_policy"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Drop all policies
    DROP POLICY IF EXISTS "test_attempts_insert_policy" ON test_attempts;
    DROP POLICY IF EXISTS "test_attempts_select_policy" ON test_attempts;
    DROP POLICY IF EXISTS "test_attempts_update_policy" ON test_attempts;
    DROP POLICY IF EXISTS "test_attempts_delete_policy" ON test_attempts;
    
    -- Create ultra-permissive policy for debugging
    CREATE POLICY "emergency_bypass_policy" ON test_attempts
        FOR ALL 
        USING (auth.uid() IS NOT NULL)
        WITH CHECK (auth.uid() IS NOT NULL);
    
    RETURN 'Emergency bypass policy created - REMOVE THIS IN PRODUCTION!';
END;
$$;


ALTER FUNCTION "public"."create_emergency_bypass_policy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_practice_session"("target_user_id" "uuid", "module_name" "text" DEFAULT 'english1'::"text", "is_single_question" boolean DEFAULT false) RETURNS TABLE("success" boolean, "attempt_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    new_attempt_id UUID;
    current_auth_uid UUID;
BEGIN
    current_auth_uid := auth.uid();
    
    -- Verify the requesting user matches the target user
    IF current_auth_uid IS NULL THEN
        RETURN QUERY VALUES (false, NULL::UUID, 'Not authenticated');
        RETURN;
    END IF;
    
    IF current_auth_uid != target_user_id THEN
        RETURN QUERY VALUES (false, NULL::UUID, 'User ID mismatch');
        RETURN;
    END IF;
    
    -- Create the practice attempt
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number,
            created_at,
            updated_at
        ) VALUES (
            target_user_id,
            NULL,
            'not_started',
            true,
            module_name,
            1,
            NOW(),
            NOW()
        ) RETURNING id INTO new_attempt_id;
        
        RETURN QUERY VALUES (true, new_attempt_id, 'Practice session created successfully');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES (false, NULL::UUID, SQLERRM);
    END;
END;
$$;


ALTER FUNCTION "public"."create_practice_session"("target_user_id" "uuid", "module_name" "text", "is_single_question" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_current_user_test_attempt"() RETURNS TABLE("step" "text", "value" "text", "success" boolean, "details" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_uid UUID;
    user_email TEXT;
    user_role TEXT;
    profile_exists BOOLEAN;
    test_exam_id UUID := 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    test_attempt_id UUID;
BEGIN
    -- Get current auth info
    current_uid := auth.uid();
    
    -- Get user email
    SELECT auth.email() INTO user_email;
    
    -- Get user role from auth.jwt()
    SELECT auth.jwt() ->> 'role' INTO user_role;
    
    -- Check if user profile exists
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = current_uid) INTO profile_exists;
    
    -- Return debug info step by step
    RETURN QUERY VALUES 
        ('auth_uid', COALESCE(current_uid::TEXT, 'NULL'), current_uid IS NOT NULL, 'Current authenticated user ID'),
        ('auth_email', COALESCE(user_email, 'NULL'), user_email IS NOT NULL, 'Current user email'),
        ('auth_role', COALESCE(user_role, 'NULL'), user_role IS NOT NULL, 'Current user role'),
        ('profile_exists', profile_exists::TEXT, profile_exists, 'User profile exists in user_profiles table'),
        ('exam_id', test_exam_id::TEXT, true, 'Target exam ID');
    
    -- Try to create test attempt with detailed error catching
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number
        ) VALUES (
            current_uid,
            test_exam_id,
            'not_started',
            false,
            'english1',
            1
        ) RETURNING id INTO test_attempt_id;
        
        -- If successful, clean up and report success
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('insert_test', 'SUCCESS', true, 'Test attempt created and deleted successfully');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('insert_test', 'FAILED', false, SQLERRM);
    END;
    
    -- Also try practice mode
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number
        ) VALUES (
            current_uid,
            NULL,
            'not_started',
            true,
            'english1',
            1
        ) RETURNING id INTO test_attempt_id;
        
        -- If successful, clean up and report success
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('insert_practice', 'SUCCESS', true, 'Practice attempt created and deleted successfully');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('insert_practice', 'FAILED', false, SQLERRM);
    END;
END;
$$;


ALTER FUNCTION "public"."debug_current_user_test_attempt"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_exam_access"("exam_uuid" "uuid") RETURNS TABLE("check_name" "text", "result" boolean, "details" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    exam_exists BOOLEAN;
    exam_active BOOLEAN;
    user_can_see_exam BOOLEAN;
    current_uid UUID;
BEGIN
    current_uid := auth.uid();
    
    -- Check if exam exists
    SELECT EXISTS(SELECT 1 FROM exams WHERE id = exam_uuid) INTO exam_exists;
    
    -- Check if exam is active
    SELECT is_active FROM exams WHERE id = exam_uuid INTO exam_active;
    
    -- Check if user can see the exam (based on RLS)
    BEGIN
        SELECT EXISTS(SELECT 1 FROM exams WHERE id = exam_uuid) INTO user_can_see_exam;
    EXCEPTION WHEN OTHERS THEN
        user_can_see_exam := false;
    END;
    
    RETURN QUERY VALUES 
        ('exam_exists', exam_exists, 'Exam exists in database'),
        ('exam_active', COALESCE(exam_active, false), 'Exam is active'),
        ('user_can_see_exam', user_can_see_exam, 'User can see exam (RLS check)'),
        ('current_user_id', current_uid IS NOT NULL, 'Current user: ' || COALESCE(current_uid::TEXT, 'NULL'));
END;
$$;


ALTER FUNCTION "public"."debug_exam_access"("exam_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_practice_creation"("test_user_id" "uuid") RETURNS TABLE("step" "text", "success" boolean, "auth_uid_value" "uuid", "provided_user_id" "uuid", "ids_match" boolean, "user_profile_exists" boolean, "error_details" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_auth_uid UUID;
    profile_exists BOOLEAN;
BEGIN
    -- Get current auth uid
    current_auth_uid := auth.uid();
    
    -- Check if user profile exists
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = current_auth_uid) INTO profile_exists;
    
    -- Return step-by-step debug info
    RETURN QUERY VALUES 
        ('auth_check', current_auth_uid IS NOT NULL, current_auth_uid, test_user_id, current_auth_uid = test_user_id, profile_exists, 
         CASE WHEN current_auth_uid IS NULL THEN 'No auth.uid() found' ELSE 'Auth OK' END),
        ('id_match', current_auth_uid = test_user_id, current_auth_uid, test_user_id, current_auth_uid = test_user_id, profile_exists,
         CASE WHEN current_auth_uid != test_user_id THEN 'User ID mismatch' ELSE 'IDs match' END),
        ('profile_check', profile_exists, current_auth_uid, test_user_id, current_auth_uid = test_user_id, profile_exists,
         CASE WHEN NOT profile_exists THEN 'User profile missing' ELSE 'Profile exists' END);
END;
$$;


ALTER FUNCTION "public"."debug_practice_creation"("test_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_rls_bypass_test"("exam_uuid" "uuid") RETURNS TABLE("test_name" "text", "success" boolean, "error_msg" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_uid UUID;
    test_attempt_id UUID;
BEGIN
    current_uid := auth.uid();
    
    -- Test 1: Try with RLS enabled (normal)
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode
        ) VALUES (
            current_uid,
            exam_uuid,
            'not_started',
            false
        ) RETURNING id INTO test_attempt_id;
        
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('with_rls', true, 'Success');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('with_rls', false, SQLERRM);
    END;
    
    -- Test 2: Check if we can insert with bypassing RLS (as superuser function)
    BEGIN
        -- This function runs as SECURITY DEFINER so it should bypass RLS
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode
        ) VALUES (
            current_uid,
            exam_uuid,
            'not_started',
            false
        ) RETURNING id INTO test_attempt_id;
        
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('bypass_rls', true, 'Success - RLS is the issue');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('bypass_rls', false, SQLERRM);
    END;
END;
$$;


ALTER FUNCTION "public"."debug_rls_bypass_test"("exam_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_test_attempt_creation"("target_user_id" "uuid", "target_exam_id" "uuid", "is_practice" boolean DEFAULT false) RETURNS TABLE("step" "text", "success" boolean, "current_auth_uid" "uuid", "provided_user_id" "uuid", "provided_exam_id" "uuid", "ids_match" boolean, "error_details" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_uid UUID;
    test_attempt_id UUID;
BEGIN
    -- Get current auth uid
    current_uid := auth.uid();
    
    -- Return step-by-step debug info
    RETURN QUERY VALUES 
        ('auth_check', current_uid IS NOT NULL, current_uid, target_user_id, target_exam_id, current_uid = target_user_id, 
         CASE WHEN current_uid IS NULL THEN 'No auth.uid() found' ELSE 'Auth OK' END),
        ('id_match', current_uid = target_user_id, current_uid, target_user_id, target_exam_id, current_uid = target_user_id,
         CASE WHEN current_uid != target_user_id THEN 'User ID mismatch' ELSE 'IDs match' END);
    
    -- Try to create a test attempt
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number
        ) VALUES (
            target_user_id,
            target_exam_id,
            'not_started',
            is_practice,
            'english1',
            1
        ) RETURNING id INTO test_attempt_id;
        
        -- Clean up the test record
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('insert_test', true, current_uid, target_user_id, target_exam_id, current_uid = target_user_id, 'Success');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('insert_test', false, current_uid, target_user_id, target_exam_id, current_uid = target_user_id, SQLERRM);
    END;
END;
$$;


ALTER FUNCTION "public"."debug_test_attempt_creation"("target_user_id" "uuid", "target_exam_id" "uuid", "is_practice" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_exams_list"() RETURNS TABLE("id" "uuid", "title" character varying, "description" "text", "created_at" timestamp with time zone, "is_active" boolean, "total_questions" integer, "english_curve_id" integer, "math_curve_id" integer, "english_curve_name" "text", "math_curve_name" "text", "latest_attempt_visibility" boolean, "latest_attempt_visible_after" timestamp with time zone, "total_attempts_count" bigint)
    LANGUAGE "plpgsql"
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
$$;


ALTER FUNCTION "public"."get_admin_exams_list"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_report_attempts"() RETURNS TABLE("attempt_id" "uuid", "completed_at" timestamp with time zone, "duration_seconds" bigint, "final_scores" "jsonb", "student_id" "uuid", "student_full_name" character varying, "student_email" character varying, "exam_id" "uuid", "exam_title" character varying)
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


ALTER FUNCTION "public"."get_admin_report_attempts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_grid_in_answers"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update existing grid_in questions to use the new array format
  UPDATE questions 
  SET correct_answers = ARRAY[correct_answer]
  WHERE question_type = 'grid_in' 
  AND correct_answer IS NOT NULL 
  AND correct_answers IS NULL;
  
  RAISE NOTICE 'Migrated % grid_in questions to use correct_answers array', (
    SELECT COUNT(*) FROM questions 
    WHERE question_type = 'grid_in' AND correct_answers IS NOT NULL
  );
END;
$$;


ALTER FUNCTION "public"."migrate_grid_in_answers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."should_show_answers"("attempt_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    attempt_record RECORD;
BEGIN
    -- Get attempt data
    SELECT 
        ta.answers_visible,
        ta.answers_visible_after,
        up.show_correct_answers
    INTO attempt_record
    FROM public.test_attempts ta
    JOIN public.user_profiles up ON up.id = ta.user_id
    WHERE ta.id = attempt_id;
    
    -- If no record found, return false
    IF attempt_record IS NULL THEN
        RETURN false;
    END IF;
    
    -- If answers are explicitly set to visible for this attempt
    IF attempt_record.answers_visible = true THEN
        -- Check if there's a time restriction
        IF attempt_record.answers_visible_after IS NOT NULL THEN
            RETURN now() >= attempt_record.answers_visible_after;
        ELSE
            RETURN true;
        END IF;
    END IF;
    
    -- Fall back to user profile setting for backwards compatibility
    RETURN COALESCE(attempt_record.show_correct_answers, false);
END;
$$;


ALTER FUNCTION "public"."should_show_answers"("attempt_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."should_show_answers"("attempt_id" "uuid") IS 'Determines if answers should be visible for a given attempt, considering both attempt-level and user-level settings.';



CREATE OR REPLACE FUNCTION "public"."test_auth_uid"() RETURNS TABLE("current_auth_uid" "uuid", "current_auth_role" "text", "auth_user_exists" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        auth.uid() as current_auth_uid,
        auth.role() as current_auth_role,
        (auth.uid() IS NOT NULL) as auth_user_exists;
END;
$$;


ALTER FUNCTION "public"."test_auth_uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_practice_insert"("test_user_id" "uuid") RETURNS TABLE("success" boolean, "attempt_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    new_attempt_id UUID;
    current_auth_uid UUID;
BEGIN
    current_auth_uid := auth.uid();
    
    -- Try to insert a test attempt
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number
        ) VALUES (
            test_user_id,
            NULL,
            'not_started',
            true,
            'english1',
            1
        ) RETURNING id INTO new_attempt_id;
        
        -- Clean up the test record
        DELETE FROM test_attempts WHERE id = new_attempt_id;
        
        RETURN QUERY VALUES (true, new_attempt_id, 'Success');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES (false, NULL::UUID, SQLERRM);
    END;
END;
$$;


ALTER FUNCTION "public"."test_practice_insert"("test_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_questions_access"() RETURNS TABLE("test_name" "text", "success" boolean, "count_result" integer, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_uid UUID;
    question_count INTEGER;
    user_role TEXT;
BEGIN
    current_uid := auth.uid();
    
    -- Check current user's role
    SELECT role FROM user_profiles WHERE id = current_uid INTO user_role;
    
    -- Test: Can read questions
    BEGIN
        SELECT COUNT(*) FROM questions INTO question_count;
        RETURN QUERY VALUES ('read_questions', true, question_count, 'User role: ' || COALESCE(user_role, 'unknown'));
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('read_questions', false, 0, SQLERRM);
    END;
    
    -- Test: Auth status
    RETURN QUERY VALUES ('auth_check', current_uid IS NOT NULL, 0, 'Auth UID: ' || COALESCE(current_uid::TEXT, 'NULL'));
    
END;
$$;


ALTER FUNCTION "public"."test_questions_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_rls_fix"("exam_uuid" "uuid") RETURNS TABLE("test_name" "text", "success" boolean, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_uid UUID;
    test_attempt_id UUID;
    attempt_count INTEGER;
BEGIN
    current_uid := auth.uid();
    
    -- Test 1: Regular exam attempt
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number
        ) VALUES (
            current_uid,
            exam_uuid,
            'not_started',
            false,
            'english1',
            1
        ) RETURNING id INTO test_attempt_id;
        
        -- Clean up
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('regular_exam', true, 'Success');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('regular_exam', false, SQLERRM);
    END;
    
    -- Test 2: Practice mode attempt  
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number
        ) VALUES (
            current_uid,
            NULL,
            'not_started',
            true,
            'english1',
            1
        ) RETURNING id INTO test_attempt_id;
        
        -- Clean up
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        
        RETURN QUERY VALUES ('practice_mode', true, 'Success');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('practice_mode', false, SQLERRM);
    END;
    
    -- Test 3: Check if we can read our own attempts
    BEGIN
        SELECT COUNT(*) FROM test_attempts WHERE user_id = current_uid INTO attempt_count;
        RETURN QUERY VALUES ('read_own_attempts', true, 'Can read ' || attempt_count || ' attempts');
        
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES ('read_own_attempts', false, SQLERRM);
    END;
    
    -- Test 4: Verify auth.uid() is working
    RETURN QUERY VALUES ('auth_uid_check', current_uid IS NOT NULL, 'Current UID: ' || COALESCE(current_uid::TEXT, 'NULL'));
END;
$$;


ALTER FUNCTION "public"."test_rls_fix"("exam_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_questions_access"() RETURNS TABLE("test_description" "text", "success" boolean, "result_count" integer, "user_role" "text", "auth_uid" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_uid UUID;
    question_count INTEGER;
    user_role_value TEXT;
BEGIN
    current_uid := auth.uid();
    
    -- Get current user's role
    BEGIN
        SELECT role FROM user_profiles 
        WHERE id = current_uid 
        INTO user_role_value;
    EXCEPTION WHEN OTHERS THEN
        user_role_value := 'ERROR: ' || SQLERRM;
    END;
    
    -- Test questions access
    BEGIN
        SELECT COUNT(*) FROM questions INTO question_count;
        RETURN QUERY VALUES (
            'Questions table access test', 
            true, 
            question_count, 
            COALESCE(user_role_value, 'null'),
            COALESCE(current_uid::TEXT, 'null')
        );
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY VALUES (
            'Questions table access test', 
            false, 
            0, 
            COALESCE(user_role_value, 'null'),
            'ERROR: ' || SQLERRM
        );
    END;
    
END;
$$;


ALTER FUNCTION "public"."verify_questions_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_test_attempt_rls"() RETURNS TABLE("auth_uid" "uuid", "can_create_regular_attempt" boolean, "can_create_practice_attempt" boolean, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    current_uid UUID;
    test_exam_id UUID;
    test_attempt_id UUID;
    regular_success BOOLEAN := false;
    practice_success BOOLEAN := false;
    error_msg TEXT := '';
BEGIN
    current_uid := auth.uid();
    
    -- Use a dummy exam ID for testing
    test_exam_id := '00000000-0000-0000-0000-000000000000';
    
    -- Test regular attempt creation
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number
        ) VALUES (
            current_uid,
            test_exam_id,
            'not_started',
            false,
            'english1',
            1
        ) RETURNING id INTO test_attempt_id;
        
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        regular_success := true;
        
    EXCEPTION WHEN OTHERS THEN
        error_msg := error_msg || 'Regular attempt error: ' || SQLERRM || '; ';
    END;
    
    -- Test practice attempt creation
    BEGIN
        INSERT INTO test_attempts (
            user_id,
            exam_id,
            status,
            is_practice_mode,
            current_module,
            current_question_number
        ) VALUES (
            current_uid,
            NULL,
            'not_started',
            true,
            'english1',
            1
        ) RETURNING id INTO test_attempt_id;
        
        DELETE FROM test_attempts WHERE id = test_attempt_id;
        practice_success := true;
        
    EXCEPTION WHEN OTHERS THEN
        error_msg := error_msg || 'Practice attempt error: ' || SQLERRM || '; ';
    END;
    
    RETURN QUERY VALUES (current_uid, regular_success, practice_success, error_msg);
END;
$$;


ALTER FUNCTION "public"."verify_test_attempt_rls"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."exam_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "exam_id" "uuid",
    "student_id" "uuid",
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "due_date" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "show_results" boolean DEFAULT true
);


ALTER TABLE "public"."exam_assignments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."exam_assignments"."show_results" IS 'Controls whether students can see their results after completing the exam. Defaults to true for backward compatibility.';



CREATE TABLE IF NOT EXISTS "public"."exam_questions" (
    "id" bigint NOT NULL,
    "exam_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL
);


ALTER TABLE "public"."exam_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."exam_questions" IS 'Junction table to associate questions with custom exams/assignments.';



CREATE SEQUENCE IF NOT EXISTS "public"."exam_questions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."exam_questions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."exam_questions_id_seq" OWNED BY "public"."exam_questions"."id";



CREATE TABLE IF NOT EXISTS "public"."exams" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "is_mock_exam" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "total_questions" integer DEFAULT 154 NOT NULL,
    "time_limits" "jsonb" DEFAULT '{"math1": 35, "math2": 55, "english1": 64, "english2": 35}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "average_difficulty_index" double precision,
    "scoring_curve_id" integer,
    "english_scoring_curve_id" integer,
    "math_scoring_curve_id" integer,
    "is_custom_assignment" boolean DEFAULT false NOT NULL,
    "answer_check_mode" "text" DEFAULT 'exam_end'::"text",
    CONSTRAINT "exams_answer_check_mode_check" CHECK (("answer_check_mode" = ANY (ARRAY['exam_end'::"text", 'per_question'::"text"])))
);


ALTER TABLE "public"."exams" OWNER TO "postgres";


COMMENT ON COLUMN "public"."exams"."is_custom_assignment" IS 'True if this exam is a custom assignment generated by an admin.';



COMMENT ON COLUMN "public"."exams"."answer_check_mode" IS 'Controls when students can see correct answers: exam_end (current behavior) or per_question (immediate after each question)';



CREATE TABLE IF NOT EXISTS "public"."mistake_bank" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "status" "public"."mistake_status" DEFAULT 'unmastered'::"public"."mistake_status" NOT NULL,
    "first_mistaken_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_reviewed_at" timestamp with time zone
);


ALTER TABLE "public"."mistake_bank" OWNER TO "postgres";


COMMENT ON TABLE "public"."mistake_bank" IS 'Stores a persistent record of every question a user has answered incorrectly.';



CREATE SEQUENCE IF NOT EXISTS "public"."mistake_bank_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."mistake_bank_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mistake_bank_id_seq" OWNED BY "public"."mistake_bank"."id";



CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "exam_id" "uuid",
    "module_type" "public"."module_type" NOT NULL,
    "question_number" integer NOT NULL,
    "question_type" "public"."question_type" NOT NULL,
    "difficulty_level" "public"."difficulty_level" DEFAULT 'medium'::"public"."difficulty_level",
    "question_text" "text" NOT NULL,
    "question_image_url" character varying(500),
    "options" "jsonb",
    "correct_answer" "jsonb" NOT NULL,
    "explanation" "text",
    "points" integer DEFAULT 1,
    "topic_tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "table_data" "jsonb",
    "correct_answers" "text"[],
    CONSTRAINT "questions_correct_answer_format_check" CHECK (((("question_type" = 'grid_in'::"public"."question_type") AND ("correct_answers" IS NOT NULL)) OR (("question_type" = 'multiple_choice'::"public"."question_type") AND ("correct_answer" IS NOT NULL)) OR ("question_type" = 'essay'::"public"."question_type")))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."questions"."correct_answers" IS 'Array of correct answers for grid_in questions. For multiple_choice questions, use correct_answer field instead.';



CREATE TABLE IF NOT EXISTS "public"."quiz_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "set_id" bigint NOT NULL,
    "quiz_type" "text" NOT NULL,
    "quiz_format" "text" NOT NULL,
    "score_percentage" double precision,
    "questions_total" integer DEFAULT 0 NOT NULL,
    "questions_correct" integer DEFAULT 0 NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."quiz_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."regrade_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_answer_id" "uuid" NOT NULL,
    "attempt_id" "uuid" NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "old_is_correct" boolean,
    "new_is_correct" boolean NOT NULL,
    "reason" "text" NOT NULL,
    "regraded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."regrade_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."regrade_history" IS 'Tracks all question re-grading actions performed by administrators';



COMMENT ON COLUMN "public"."regrade_history"."user_answer_id" IS 'Reference to the user answer that was regraded';



COMMENT ON COLUMN "public"."regrade_history"."attempt_id" IS 'Reference to the test attempt containing the regraded question';



COMMENT ON COLUMN "public"."regrade_history"."admin_id" IS 'ID of the admin who performed the regrade';



COMMENT ON COLUMN "public"."regrade_history"."old_is_correct" IS 'Previous correctness status (null if it was not set)';



COMMENT ON COLUMN "public"."regrade_history"."new_is_correct" IS 'New correctness status after regrade';



COMMENT ON COLUMN "public"."regrade_history"."reason" IS 'Reason provided by admin for the regrade';



COMMENT ON COLUMN "public"."regrade_history"."regraded_at" IS 'Timestamp when the regrade was performed';



CREATE TABLE IF NOT EXISTS "public"."scoring_curves" (
    "id" integer NOT NULL,
    "curve_name" "text" NOT NULL,
    "description" "text",
    "curve_data" "jsonb" NOT NULL
);


ALTER TABLE "public"."scoring_curves" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."scoring_curves_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."scoring_curves_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."scoring_curves_id_seq" OWNED BY "public"."scoring_curves"."id";



CREATE TABLE IF NOT EXISTS "public"."test_attempts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "exam_id" "uuid",
    "status" "public"."exam_status" DEFAULT 'not_started'::"public"."exam_status",
    "current_module" "public"."module_type",
    "current_question_number" integer DEFAULT 1,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "time_spent" "jsonb" DEFAULT '{}'::"jsonb",
    "total_score" integer DEFAULT 0,
    "module_scores" "jsonb" DEFAULT '{}'::"jsonb",
    "is_practice_mode" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "final_scores" "jsonb",
    "answers_visible" boolean DEFAULT false NOT NULL,
    "answers_visible_after" timestamp with time zone
);


ALTER TABLE "public"."test_attempts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."test_attempts"."final_scores" IS 'Final calculated scores from the scoring engine: {overall: number, english: number, math: number}';



COMMENT ON COLUMN "public"."test_attempts"."answers_visible" IS 'Controls if answers are visible for this specific attempt. Takes precedence over user profile setting.';



COMMENT ON COLUMN "public"."test_attempts"."answers_visible_after" IS 'If set, answers become visible only after this timestamp. Useful for timed releases.';



CREATE TABLE IF NOT EXISTS "public"."user_answers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "attempt_id" "uuid",
    "question_id" "uuid",
    "user_answer" character varying(10),
    "is_correct" boolean,
    "time_spent_seconds" integer DEFAULT 0,
    "answered_at" timestamp with time zone DEFAULT "now"(),
    "viewed_correct_answer_at" timestamp with time zone
);


ALTER TABLE "public"."user_answers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_answers"."viewed_correct_answer_at" IS 'Timestamp when student viewed the correct answer for this question';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "role" "public"."user_role" DEFAULT 'student'::"public"."user_role",
    "grade_level" integer,
    "target_score" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "show_correct_answers" boolean DEFAULT false,
    CONSTRAINT "user_profiles_grade_level_check" CHECK ((("grade_level" >= 9) AND ("grade_level" <= 12))),
    CONSTRAINT "user_profiles_target_score_check" CHECK ((("target_score" >= 400) AND ("target_score" <= 1600)))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_profiles"."show_correct_answers" IS 'Controls whether the student can see correct answers after completing an exam. Only admins can modify this setting.';



CREATE TABLE IF NOT EXISTS "public"."vocab_entries" (
    "id" bigint NOT NULL,
    "set_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "term" "text" NOT NULL,
    "definition" "text" NOT NULL,
    "example_sentence" "text",
    "mastery_level" integer DEFAULT 0 NOT NULL,
    "last_reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text"
);


ALTER TABLE "public"."vocab_entries" OWNER TO "postgres";


COMMENT ON COLUMN "public"."vocab_entries"."mastery_level" IS '0: New, 1: Learning, 2: Familiar, 3: Known, 4: Mastered, 5: Expert';



COMMENT ON COLUMN "public"."vocab_entries"."image_url" IS 'URL for an image associated with the vocabulary term from Supabase Storage';



CREATE SEQUENCE IF NOT EXISTS "public"."vocab_entries_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."vocab_entries_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."vocab_entries_id_seq" OWNED BY "public"."vocab_entries"."id";



CREATE TABLE IF NOT EXISTS "public"."vocab_sets" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vocab_sets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."vocab_sets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."vocab_sets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."vocab_sets_id_seq" OWNED BY "public"."vocab_sets"."id";



ALTER TABLE ONLY "public"."exam_questions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."exam_questions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."mistake_bank" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mistake_bank_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."scoring_curves" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."scoring_curves_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."vocab_entries" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."vocab_entries_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."vocab_sets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."vocab_sets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."exam_assignments"
    ADD CONSTRAINT "exam_assignments_exam_id_student_id_key" UNIQUE ("exam_id", "student_id");



ALTER TABLE ONLY "public"."exam_assignments"
    ADD CONSTRAINT "exam_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_question_unique" UNIQUE ("exam_id", "question_id");



ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mistake_bank"
    ADD CONSTRAINT "mistake_bank_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_exam_id_module_type_question_number_key" UNIQUE ("exam_id", "module_type", "question_number");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quiz_sessions"
    ADD CONSTRAINT "quiz_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."regrade_history"
    ADD CONSTRAINT "regrade_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scoring_curves"
    ADD CONSTRAINT "scoring_curves_curve_name_key" UNIQUE ("curve_name");



ALTER TABLE ONLY "public"."scoring_curves"
    ADD CONSTRAINT "scoring_curves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_attempts"
    ADD CONSTRAINT "test_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_answers"
    ADD CONSTRAINT "user_answers_attempt_id_question_id_key" UNIQUE ("attempt_id", "question_id");



ALTER TABLE ONLY "public"."user_answers"
    ADD CONSTRAINT "user_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mistake_bank"
    ADD CONSTRAINT "user_question_unique" UNIQUE ("user_id", "question_id");



ALTER TABLE ONLY "public"."vocab_entries"
    ADD CONSTRAINT "vocab_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vocab_sets"
    ADD CONSTRAINT "vocab_sets_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_exam_questions_exam_id" ON "public"."exam_questions" USING "btree" ("exam_id");



CREATE INDEX "idx_exam_questions_question_id" ON "public"."exam_questions" USING "btree" ("question_id");



CREATE INDEX "idx_mistake_bank_first_mistaken_at" ON "public"."mistake_bank" USING "btree" ("first_mistaken_at");



CREATE INDEX "idx_mistake_bank_status" ON "public"."mistake_bank" USING "btree" ("status");



CREATE INDEX "idx_mistake_bank_user_id" ON "public"."mistake_bank" USING "btree" ("user_id");



CREATE INDEX "idx_questions_correct_answers" ON "public"."questions" USING "gin" ("correct_answers");



CREATE INDEX "idx_questions_difficulty" ON "public"."questions" USING "btree" ("difficulty_level");



CREATE INDEX "idx_questions_exam_module" ON "public"."questions" USING "btree" ("exam_id", "module_type");



CREATE INDEX "idx_quiz_sessions_user_id" ON "public"."quiz_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_regrade_history_admin_id" ON "public"."regrade_history" USING "btree" ("admin_id");



CREATE INDEX "idx_regrade_history_attempt_id" ON "public"."regrade_history" USING "btree" ("attempt_id");



CREATE INDEX "idx_regrade_history_regraded_at" ON "public"."regrade_history" USING "btree" ("regraded_at");



CREATE INDEX "idx_regrade_history_user_answer_id" ON "public"."regrade_history" USING "btree" ("user_answer_id");



CREATE INDEX "idx_test_attempts_answers_visible" ON "public"."test_attempts" USING "btree" ("answers_visible");



CREATE INDEX "idx_test_attempts_answers_visible_after" ON "public"."test_attempts" USING "btree" ("answers_visible_after");



CREATE INDEX "idx_test_attempts_exam" ON "public"."test_attempts" USING "btree" ("exam_id");



CREATE INDEX "idx_test_attempts_user_status" ON "public"."test_attempts" USING "btree" ("user_id", "status");



CREATE INDEX "idx_user_answers_attempt" ON "public"."user_answers" USING "btree" ("attempt_id");



CREATE INDEX "idx_user_answers_question" ON "public"."user_answers" USING "btree" ("question_id");



CREATE INDEX "idx_user_profiles_role" ON "public"."user_profiles" USING "btree" ("role");



CREATE INDEX "idx_vocab_entries_set_id" ON "public"."vocab_entries" USING "btree" ("set_id");



CREATE INDEX "idx_vocab_entries_user_id" ON "public"."vocab_entries" USING "btree" ("user_id");



CREATE INDEX "idx_vocab_sets_user_id" ON "public"."vocab_sets" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "update_exams_updated_at" BEFORE UPDATE ON "public"."exams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_questions_updated_at" BEFORE UPDATE ON "public"."questions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_test_attempts_updated_at" BEFORE UPDATE ON "public"."test_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."exam_assignments"
    ADD CONSTRAINT "exam_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exam_assignments"
    ADD CONSTRAINT "exam_assignments_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_assignments"
    ADD CONSTRAINT "exam_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_questions"
    ADD CONSTRAINT "exam_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_english_scoring_curve_id_fkey" FOREIGN KEY ("english_scoring_curve_id") REFERENCES "public"."scoring_curves"("id");



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_math_scoring_curve_id_fkey" FOREIGN KEY ("math_scoring_curve_id") REFERENCES "public"."scoring_curves"("id");



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_scoring_curve_id_fkey" FOREIGN KEY ("scoring_curve_id") REFERENCES "public"."scoring_curves"("id");



ALTER TABLE ONLY "public"."mistake_bank"
    ADD CONSTRAINT "mistake_bank_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mistake_bank"
    ADD CONSTRAINT "mistake_bank_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_sessions"
    ADD CONSTRAINT "quiz_sessions_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "public"."vocab_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quiz_sessions"
    ADD CONSTRAINT "quiz_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."regrade_history"
    ADD CONSTRAINT "regrade_history_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."regrade_history"
    ADD CONSTRAINT "regrade_history_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."test_attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."regrade_history"
    ADD CONSTRAINT "regrade_history_user_answer_id_fkey" FOREIGN KEY ("user_answer_id") REFERENCES "public"."user_answers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_attempts"
    ADD CONSTRAINT "test_attempts_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_attempts"
    ADD CONSTRAINT "test_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_answers"
    ADD CONSTRAINT "user_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."test_attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_answers"
    ADD CONSTRAINT "user_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vocab_entries"
    ADD CONSTRAINT "vocab_entries_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "public"."vocab_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vocab_entries"
    ADD CONSTRAINT "vocab_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vocab_sets"
    ADD CONSTRAINT "vocab_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admin users can insert regrade history" ON "public"."regrade_history" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admin users can update all answers" ON "public"."user_answers" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



COMMENT ON POLICY "Admin users can update all answers" ON "public"."user_answers" IS 'Allows admin users to update user answers for regrading purposes';



CREATE POLICY "Admin users can update all attempts" ON "public"."test_attempts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



COMMENT ON POLICY "Admin users can update all attempts" ON "public"."test_attempts" IS 'Allows admin users to update test attempts for score recalculation after regrading';



CREATE POLICY "Admin users can view all answers" ON "public"."user_answers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



COMMENT ON POLICY "Admin users can view all answers" ON "public"."user_answers" IS 'Allows admin users to view all user answers for regrading purposes';



CREATE POLICY "Admin users can view all attempts" ON "public"."test_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



COMMENT ON POLICY "Admin users can view all attempts" ON "public"."test_attempts" IS 'Allows admin users to view all test attempts for management purposes';



CREATE POLICY "Admin users can view regrade history" ON "public"."regrade_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can create exams" ON "public"."exams" FOR INSERT WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can delete exams" ON "public"."exams" FOR DELETE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can delete profiles" ON "public"."user_profiles" FOR DELETE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can insert mistakes for any user" ON "public"."mistake_bank" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can manage exam questions" ON "public"."exam_questions" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update any mistakes" ON "public"."mistake_bank" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update any profile" ON "public"."user_profiles" FOR UPDATE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can update exams" ON "public"."exams" FOR UPDATE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can view all exams" ON "public"."exams" FOR SELECT USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can view all mistakes" ON "public"."mistake_bank" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can view all profiles" ON "public"."user_profiles" FOR SELECT USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Authenticated users can create profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Everyone can view exam questions" ON "public"."exam_questions" FOR SELECT USING (true);



CREATE POLICY "Students can insert their own mistakes" ON "public"."mistake_bank" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Students can update their own mistakes" ON "public"."mistake_bank" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Students can view their own mistakes" ON "public"."mistake_bank" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own quiz sessions" ON "public"."quiz_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own vocab entries" ON "public"."vocab_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own vocab sets" ON "public"."vocab_sets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own vocab entries" ON "public"."vocab_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own vocab sets" ON "public"."vocab_sets" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own answers" ON "public"."user_answers" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."test_attempts"
  WHERE (("test_attempts"."id" = "user_answers"."attempt_id") AND ("test_attempts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own answers" ON "public"."user_answers" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."test_attempts"
  WHERE (("test_attempts"."id" = "user_answers"."attempt_id") AND ("test_attempts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own attempts" ON "public"."test_attempts" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own quiz sessions" ON "public"."quiz_sessions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own vocab entries" ON "public"."vocab_entries" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own vocab sets" ON "public"."vocab_sets" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view active exams" ON "public"."exams" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Users can view their own answers" ON "public"."user_answers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."test_attempts"
  WHERE (("test_attempts"."id" = "user_answers"."attempt_id") AND ("test_attempts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own attempts" ON "public"."test_attempts" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own quiz sessions" ON "public"."quiz_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own vocab entries" ON "public"."vocab_entries" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own vocab sets" ON "public"."vocab_sets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "authenticated_users_read_own_profile" ON "public"."user_profiles" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("auth"."uid"() = "id")));



ALTER TABLE "public"."exam_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mistake_bank" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "questions_admin_delete" ON "public"."questions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "questions_admin_insert" ON "public"."questions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "questions_admin_update" ON "public"."questions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "questions_read_access" ON "public"."questions" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."quiz_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."regrade_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "test_attempts_delete_policy" ON "public"."test_attempts" FOR DELETE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role"))))));



CREATE POLICY "test_attempts_insert_policy" ON "public"."test_attempts" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"()) AND (("exam_id" IS NOT NULL) OR ("is_practice_mode" = true))));



CREATE POLICY "test_attempts_select_policy" ON "public"."test_attempts" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role"))))));



CREATE POLICY "test_attempts_update_policy" ON "public"."test_attempts" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_profiles"
  WHERE (("user_profiles"."id" = "auth"."uid"()) AND ("user_profiles"."role" = 'admin'::"public"."user_role"))))));



ALTER TABLE "public"."user_answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_profiles_read_own" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "users_read_own_profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."vocab_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vocab_sets" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."bulk_update_vocab_progress"("p_user_id" "uuid", "results" "public"."quiz_result_input"[], "p_mastery_max" integer, "p_mastery_min" integer, "p_interval_multiplier" double precision, "p_incorrect_reset_interval" integer, "p_incorrect_next_review_minutes" integer, "p_max_review_interval_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_update_vocab_progress"("p_user_id" "uuid", "results" "public"."quiz_result_input"[], "p_mastery_max" integer, "p_mastery_min" integer, "p_interval_multiplier" double precision, "p_incorrect_reset_interval" integer, "p_incorrect_next_review_minutes" integer, "p_max_review_interval_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_update_vocab_progress"("p_user_id" "uuid", "results" "public"."quiz_result_input"[], "p_mastery_max" integer, "p_mastery_min" integer, "p_interval_multiplier" double precision, "p_incorrect_reset_interval" integer, "p_incorrect_next_review_minutes" integer, "p_max_review_interval_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_auth_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_auth_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_auth_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_emergency_bypass_policy"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_emergency_bypass_policy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_emergency_bypass_policy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_practice_session"("target_user_id" "uuid", "module_name" "text", "is_single_question" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_practice_session"("target_user_id" "uuid", "module_name" "text", "is_single_question" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_practice_session"("target_user_id" "uuid", "module_name" "text", "is_single_question" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_current_user_test_attempt"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_current_user_test_attempt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_current_user_test_attempt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_exam_access"("exam_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."debug_exam_access"("exam_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_exam_access"("exam_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_practice_creation"("test_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."debug_practice_creation"("test_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_practice_creation"("test_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_rls_bypass_test"("exam_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."debug_rls_bypass_test"("exam_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_rls_bypass_test"("exam_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_test_attempt_creation"("target_user_id" "uuid", "target_exam_id" "uuid", "is_practice" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."debug_test_attempt_creation"("target_user_id" "uuid", "target_exam_id" "uuid", "is_practice" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_test_attempt_creation"("target_user_id" "uuid", "target_exam_id" "uuid", "is_practice" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_exams_list"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_exams_list"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_exams_list"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_report_attempts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_report_attempts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_report_attempts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_grid_in_answers"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_grid_in_answers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_grid_in_answers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."should_show_answers"("attempt_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."should_show_answers"("attempt_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."should_show_answers"("attempt_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."test_auth_uid"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_auth_uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_auth_uid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."test_practice_insert"("test_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."test_practice_insert"("test_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_practice_insert"("test_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."test_questions_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_questions_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_questions_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."test_rls_fix"("exam_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."test_rls_fix"("exam_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_rls_fix"("exam_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_questions_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."verify_questions_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_questions_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_test_attempt_rls"() TO "anon";
GRANT ALL ON FUNCTION "public"."verify_test_attempt_rls"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_test_attempt_rls"() TO "service_role";


















GRANT ALL ON TABLE "public"."exam_assignments" TO "anon";
GRANT ALL ON TABLE "public"."exam_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."exam_questions" TO "anon";
GRANT ALL ON TABLE "public"."exam_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_questions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."exam_questions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exam_questions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exam_questions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."exams" TO "anon";
GRANT ALL ON TABLE "public"."exams" TO "authenticated";
GRANT ALL ON TABLE "public"."exams" TO "service_role";



GRANT ALL ON TABLE "public"."mistake_bank" TO "anon";
GRANT ALL ON TABLE "public"."mistake_bank" TO "authenticated";
GRANT ALL ON TABLE "public"."mistake_bank" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mistake_bank_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mistake_bank_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mistake_bank_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON TABLE "public"."quiz_sessions" TO "anon";
GRANT ALL ON TABLE "public"."quiz_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."quiz_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."regrade_history" TO "anon";
GRANT ALL ON TABLE "public"."regrade_history" TO "authenticated";
GRANT ALL ON TABLE "public"."regrade_history" TO "service_role";



GRANT ALL ON TABLE "public"."scoring_curves" TO "anon";
GRANT ALL ON TABLE "public"."scoring_curves" TO "authenticated";
GRANT ALL ON TABLE "public"."scoring_curves" TO "service_role";



GRANT ALL ON SEQUENCE "public"."scoring_curves_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."scoring_curves_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."scoring_curves_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."test_attempts" TO "anon";
GRANT ALL ON TABLE "public"."test_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."test_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."user_answers" TO "anon";
GRANT ALL ON TABLE "public"."user_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."user_answers" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."vocab_entries" TO "anon";
GRANT ALL ON TABLE "public"."vocab_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."vocab_entries" TO "service_role";



GRANT ALL ON SEQUENCE "public"."vocab_entries_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vocab_entries_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vocab_entries_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vocab_sets" TO "anon";
GRANT ALL ON TABLE "public"."vocab_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."vocab_sets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."vocab_sets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."vocab_sets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."vocab_sets_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
