

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


CREATE TYPE "public"."user_role" AS ENUM (
    'student',
    'admin'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


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
        SELECT 1 FROM user_profiles 
        WHERE id = user_id AND role = 'admin'
    );
END;
$$;


ALTER FUNCTION "public"."is_admin"("user_id" "uuid") OWNER TO "postgres";


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
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."exam_assignments" OWNER TO "postgres";


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
    "math_scoring_curve_id" integer
);


ALTER TABLE "public"."exams" OWNER TO "postgres";


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
    "table_data" "jsonb"
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


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
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."test_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_answers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "attempt_id" "uuid",
    "question_id" "uuid",
    "user_answer" character varying(10),
    "is_correct" boolean,
    "time_spent_seconds" integer DEFAULT 0,
    "answered_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_answers" OWNER TO "postgres";


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



ALTER TABLE ONLY "public"."scoring_curves" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."scoring_curves_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."exam_assignments"
    ADD CONSTRAINT "exam_assignments_exam_id_student_id_key" UNIQUE ("exam_id", "student_id");



ALTER TABLE ONLY "public"."exam_assignments"
    ADD CONSTRAINT "exam_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_exam_id_module_type_question_number_key" UNIQUE ("exam_id", "module_type", "question_number");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



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



CREATE INDEX "idx_questions_difficulty" ON "public"."questions" USING "btree" ("difficulty_level");



CREATE INDEX "idx_questions_exam_module" ON "public"."questions" USING "btree" ("exam_id", "module_type");



CREATE INDEX "idx_test_attempts_exam" ON "public"."test_attempts" USING "btree" ("exam_id");



CREATE INDEX "idx_test_attempts_user_status" ON "public"."test_attempts" USING "btree" ("user_id", "status");



CREATE INDEX "idx_user_answers_attempt" ON "public"."user_answers" USING "btree" ("attempt_id");



CREATE INDEX "idx_user_answers_question" ON "public"."user_answers" USING "btree" ("question_id");



CREATE INDEX "idx_user_profiles_role" ON "public"."user_profiles" USING "btree" ("role");



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



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_english_scoring_curve_id_fkey" FOREIGN KEY ("english_scoring_curve_id") REFERENCES "public"."scoring_curves"("id");



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_math_scoring_curve_id_fkey" FOREIGN KEY ("math_scoring_curve_id") REFERENCES "public"."scoring_curves"("id");



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_scoring_curve_id_fkey" FOREIGN KEY ("scoring_curve_id") REFERENCES "public"."scoring_curves"("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE CASCADE;



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



CREATE POLICY "Admins can create exams" ON "public"."exams" FOR INSERT WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can delete answers" ON "public"."user_answers" FOR DELETE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can delete exams" ON "public"."exams" FOR DELETE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can delete profiles" ON "public"."user_profiles" FOR DELETE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can update any answer" ON "public"."user_answers" FOR UPDATE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can update any profile" ON "public"."user_profiles" FOR UPDATE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can update exams" ON "public"."exams" FOR UPDATE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can view all answers" ON "public"."user_answers" FOR SELECT USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can view all exams" ON "public"."exams" FOR SELECT USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Admins can view all profiles" ON "public"."user_profiles" FOR SELECT USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "Authenticated users can create profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can create own answers" ON "public"."user_answers" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."test_attempts"
  WHERE (("test_attempts"."id" = "user_answers"."attempt_id") AND ("test_attempts"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own answers" ON "public"."user_answers" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."test_attempts"
  WHERE (("test_attempts"."id" = "user_answers"."attempt_id") AND ("test_attempts"."user_id" = "auth"."uid"()) AND ("test_attempts"."status" = 'in_progress'::"public"."exam_status")))));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view active exams" ON "public"."exams" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Users can view own answers" ON "public"."user_answers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."test_attempts"
  WHERE (("test_attempts"."id" = "user_answers"."attempt_id") AND ("test_attempts"."user_id" = "auth"."uid"())))));



CREATE POLICY "authenticated_users_read_own_profile" ON "public"."user_profiles" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("auth"."uid"() = "id")));



ALTER TABLE "public"."exams" ENABLE ROW LEVEL SECURITY;


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



CREATE POLICY "users_delete_own_answers" ON "public"."user_answers" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."test_attempts"
  WHERE (("test_attempts"."id" = "user_answers"."attempt_id") AND ("test_attempts"."user_id" = "auth"."uid"()) AND ("test_attempts"."status" = 'in_progress'::"public"."exam_status")))));



CREATE POLICY "users_read_own_profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































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



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_id" "uuid") TO "service_role";



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



GRANT ALL ON TABLE "public"."exams" TO "anon";
GRANT ALL ON TABLE "public"."exams" TO "authenticated";
GRANT ALL ON TABLE "public"."exams" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



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
