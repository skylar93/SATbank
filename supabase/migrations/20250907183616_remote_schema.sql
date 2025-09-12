create type "public"."difficulty_level" as enum ('easy', 'medium', 'hard');

create type "public"."exam_status" as enum ('not_started', 'in_progress', 'completed', 'expired');

create type "public"."module_type" as enum ('english1', 'english2', 'math1', 'math2');

create type "public"."question_type" as enum ('multiple_choice', 'grid_in', 'essay');

create type "public"."user_role" as enum ('student', 'admin');

create sequence "public"."scoring_curves_id_seq";

drop trigger if exists "set_exams_updated_at" on "public"."exams";

drop trigger if exists "set_questions_updated_at" on "public"."questions";

drop trigger if exists "set_test_attempts_updated_at" on "public"."test_attempts";

drop trigger if exists "set_user_answers_updated_at" on "public"."user_answers";

drop trigger if exists "set_user_profiles_updated_at" on "public"."user_profiles";

drop policy "Admins can manage all assignments" on "public"."exam_assignments";

drop policy "Students can view their own assignments" on "public"."exam_assignments";

drop policy "Admins can manage exams" on "public"."exams";

drop policy "Users can view authorized exams" on "public"."exams";

drop policy "Admins can manage questions" on "public"."questions";

drop policy "Everyone can view questions" on "public"."questions";

drop policy "Admins can view all attempts" on "public"."test_attempts";

drop policy "Users can create authorized test attempts" on "public"."test_attempts";

drop policy "Users can create test attempts including custom assignments" on "public"."test_attempts";

drop policy "Users can update own attempts" on "public"."test_attempts";

drop policy "Users can view own attempts" on "public"."test_attempts";

drop policy "Admins can update all answers" on "public"."user_answers";

drop policy "Admins can view all answers" on "public"."user_answers";

drop policy "Users can insert own answers" on "public"."user_answers";

drop policy "Users can update own answers" on "public"."user_answers";

drop policy "Users can view own answers" on "public"."user_answers";

drop policy "Admins can update all profiles" on "public"."user_profiles";

drop policy "Users can view own profile" on "public"."user_profiles";

drop policy "Admins can manage exam questions" on "public"."exam_questions";

drop policy "Admins can manage exam templates" on "public"."exam_templates";

drop policy "Admins can insert mistakes for any user" on "public"."mistake_bank";

drop policy "Admins can update any mistakes" on "public"."mistake_bank";

drop policy "Admins can view all mistakes" on "public"."mistake_bank";

drop policy "Admins can view all profiles" on "public"."user_profiles";

alter table "public"."exam_assignments" drop constraint "exam_assignment_unique";

alter table "public"."exams" drop constraint "exams_template_id_fkey";

alter table "public"."questions" drop constraint "questions_difficulty_level_check";

alter table "public"."questions" drop constraint "questions_exam_id_question_number_module_type_key";

alter table "public"."questions" drop constraint "questions_module_type_check";

alter table "public"."questions" drop constraint "questions_question_type_check";

alter table "public"."test_attempts" drop constraint "test_attempts_status_check";

alter table "public"."user_profiles" drop constraint "user_profiles_role_check";

alter table "public"."exam_assignments" drop constraint "exam_assignments_assigned_by_fkey";

alter table "public"."exams" drop constraint "exams_created_by_fkey";

alter table "public"."user_profiles" drop constraint "user_profiles_id_fkey";

drop function if exists "public"."get_student_dashboard_data"(p_user_id uuid);

drop function if exists "public"."is_exam_assigned_to_user"(p_exam_id uuid, p_user_id uuid);

drop function if exists "public"."set_updated_at"();

drop function if exists "public"."get_admin_exams_list"();

drop type "public"."quiz_result_input";

drop index if exists "public"."exam_assignment_unique";

drop index if exists "public"."idx_exam_assignments_exam_id";

drop index if exists "public"."idx_exam_assignments_student_id";

drop index if exists "public"."idx_questions_exam_id";

drop index if exists "public"."idx_questions_module_type";

drop index if exists "public"."idx_test_attempts_exam_id";

drop index if exists "public"."idx_test_attempts_status";

drop index if exists "public"."idx_test_attempts_user_id";

drop index if exists "public"."idx_user_answers_attempt_id";

drop index if exists "public"."idx_user_answers_question_id";

drop index if exists "public"."idx_user_answers_viewed_at";

drop index if exists "public"."idx_user_profiles_email";

drop index if exists "public"."idx_vocab_entries_next_review";

drop index if exists "public"."idx_vocab_entries_srs_lookup";

drop index if exists "public"."questions_exam_id_question_number_module_type_key";

create table "public"."regrade_history" (
    "id" uuid not null default gen_random_uuid(),
    "user_answer_id" uuid not null,
    "attempt_id" uuid not null,
    "admin_id" uuid not null,
    "old_is_correct" boolean,
    "new_is_correct" boolean not null,
    "reason" text not null,
    "regraded_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."regrade_history" enable row level security;

create table "public"."scoring_curves" (
    "id" integer not null default nextval('scoring_curves_id_seq'::regclass),
    "curve_name" text not null,
    "description" text,
    "curve_data" jsonb not null
);


alter table "public"."exam_assignments" alter column "assigned_at" drop not null;

alter table "public"."exam_assignments" alter column "exam_id" drop not null;

alter table "public"."exam_assignments" alter column "id" set default uuid_generate_v4();

alter table "public"."exam_assignments" alter column "id" set data type uuid using "id"::uuid;

alter table "public"."exam_assignments" alter column "is_active" drop not null;

alter table "public"."exam_assignments" alter column "show_results" drop not null;

alter table "public"."exam_assignments" alter column "student_id" drop not null;

alter table "public"."exam_assignments" disable row level security;

alter table "public"."exam_questions" add column "module_type" text;

alter table "public"."exam_questions" add column "question_number" integer;

alter table "public"."exams" drop column "duration";

alter table "public"."exams" add column "average_difficulty_index" double precision;

alter table "public"."exams" add column "english_scoring_curve_id" integer;

alter table "public"."exams" add column "is_mock_exam" boolean default true;

alter table "public"."exams" add column "math_scoring_curve_id" integer;

alter table "public"."exams" add column "scoring_curve_id" integer;

alter table "public"."exams" add column "time_limits" jsonb not null default '{"math1": 35, "math2": 55, "english1": 64, "english2": 35}'::jsonb;

alter table "public"."exams" alter column "id" set default uuid_generate_v4();

alter table "public"."exams" alter column "is_active" drop not null;

alter table "public"."exams" alter column "title" set data type character varying(255) using "title"::character varying(255);

alter table "public"."exams" alter column "total_questions" set default 154;

alter table "public"."questions" add column "content_format" text not null default 'markdown'::text;

alter table "public"."questions" add column "points" integer default 1;

alter table "public"."questions" alter column "correct_answer" set not null;

alter table "public"."questions" alter column "correct_answer" set data type jsonb using "correct_answer"::jsonb;

alter table "public"."questions" alter column "correct_answers" set data type text[] using "correct_answers"::text[];

alter table "public"."questions" alter column "difficulty_level" set default 'medium'::difficulty_level;

alter table "public"."questions" alter column "difficulty_level" set data type difficulty_level using "difficulty_level"::difficulty_level;

alter table "public"."questions" alter column "id" set default uuid_generate_v4();

alter table "public"."questions" alter column "module_type" set data type module_type using "module_type"::module_type;

alter table "public"."questions" alter column "question_image_url" set data type character varying(500) using "question_image_url"::character varying(500);

alter table "public"."questions" alter column "question_type" set data type question_type using "question_type"::question_type;

alter table "public"."test_attempts" add column "current_module" module_type;

alter table "public"."test_attempts" add column "current_question_number" integer default 1;

alter table "public"."test_attempts" add column "expires_at" timestamp with time zone;

alter table "public"."test_attempts" add column "is_practice_mode" boolean default false;

alter table "public"."test_attempts" alter column "exam_id" drop not null;

alter table "public"."test_attempts" alter column "id" set default uuid_generate_v4();

alter table "public"."test_attempts" alter column "started_at" drop default;

alter table "public"."test_attempts" alter column "status" set default 'not_started'::exam_status;

alter table "public"."test_attempts" alter column "status" drop not null;

alter table "public"."test_attempts" alter column "status" set data type exam_status using "status"::exam_status;

alter table "public"."test_attempts" alter column "time_spent" set default '{}'::jsonb;

alter table "public"."test_attempts" alter column "time_spent" set data type jsonb using "time_spent"::jsonb;

alter table "public"."test_attempts" alter column "user_id" drop not null;

alter table "public"."user_answers" drop column "created_at";

alter table "public"."user_answers" drop column "time_spent";

alter table "public"."user_answers" drop column "updated_at";

alter table "public"."user_answers" add column "answered_at" timestamp with time zone default now();

alter table "public"."user_answers" add column "time_spent_seconds" integer default 0;

alter table "public"."user_answers" alter column "attempt_id" drop not null;

alter table "public"."user_answers" alter column "id" set default uuid_generate_v4();

alter table "public"."user_answers" alter column "question_id" drop not null;

alter table "public"."user_answers" alter column "user_answer" set data type character varying(10) using "user_answer"::character varying(10);

alter table "public"."user_profiles" alter column "email" set not null;

alter table "public"."user_profiles" alter column "email" set data type character varying(255) using "email"::character varying(255);

alter table "public"."user_profiles" alter column "full_name" set not null;

alter table "public"."user_profiles" alter column "full_name" set data type character varying(255) using "full_name"::character varying(255);

alter table "public"."user_profiles" alter column "role" set default 'student'::user_role;

alter table "public"."user_profiles" alter column "role" drop not null;

alter table "public"."user_profiles" alter column "role" set data type user_role using "role"::user_role;

alter table "public"."user_profiles" alter column "show_correct_answers" set default false;

alter table "public"."user_profiles" alter column "show_correct_answers" drop not null;

alter table "public"."vocab_entries" drop column "next_review_date";

alter table "public"."vocab_entries" drop column "review_interval";

alter sequence "public"."scoring_curves_id_seq" owned by "public"."scoring_curves"."id";

drop sequence if exists "public"."exam_assignments_id_seq";

CREATE UNIQUE INDEX exam_assignments_exam_id_student_id_key ON public.exam_assignments USING btree (exam_id, student_id);

CREATE INDEX idx_exam_questions_module_type ON public.exam_questions USING btree (module_type);

CREATE INDEX idx_questions_correct_answers ON public.questions USING gin (correct_answers);

CREATE INDEX idx_questions_difficulty ON public.questions USING btree (difficulty_level);

CREATE INDEX idx_questions_exam_module ON public.questions USING btree (exam_id, module_type);

CREATE INDEX idx_regrade_history_admin_id ON public.regrade_history USING btree (admin_id);

CREATE INDEX idx_regrade_history_attempt_id ON public.regrade_history USING btree (attempt_id);

CREATE INDEX idx_regrade_history_regraded_at ON public.regrade_history USING btree (regraded_at);

CREATE INDEX idx_regrade_history_user_answer_id ON public.regrade_history USING btree (user_answer_id);

CREATE INDEX idx_test_attempts_exam ON public.test_attempts USING btree (exam_id);

CREATE INDEX idx_test_attempts_user_status ON public.test_attempts USING btree (user_id, status);

CREATE INDEX idx_user_answers_attempt ON public.user_answers USING btree (attempt_id);

CREATE INDEX idx_user_answers_question ON public.user_answers USING btree (question_id);

CREATE UNIQUE INDEX questions_exam_id_module_type_question_number_key ON public.questions USING btree (exam_id, module_type, question_number);

CREATE UNIQUE INDEX regrade_history_pkey ON public.regrade_history USING btree (id);

CREATE UNIQUE INDEX scoring_curves_curve_name_key ON public.scoring_curves USING btree (curve_name);

CREATE UNIQUE INDEX scoring_curves_pkey ON public.scoring_curves USING btree (id);

alter table "public"."regrade_history" add constraint "regrade_history_pkey" PRIMARY KEY using index "regrade_history_pkey";

alter table "public"."scoring_curves" add constraint "scoring_curves_pkey" PRIMARY KEY using index "scoring_curves_pkey";

alter table "public"."exam_assignments" add constraint "exam_assignments_exam_id_student_id_key" UNIQUE using index "exam_assignments_exam_id_student_id_key";

alter table "public"."exam_questions" add constraint "exam_questions_module_type_check" CHECK ((module_type = ANY (ARRAY['english1'::text, 'english2'::text, 'math1'::text, 'math2'::text]))) not valid;

alter table "public"."exam_questions" validate constraint "exam_questions_module_type_check";

alter table "public"."exams" add constraint "exams_english_scoring_curve_id_fkey" FOREIGN KEY (english_scoring_curve_id) REFERENCES scoring_curves(id) not valid;

alter table "public"."exams" validate constraint "exams_english_scoring_curve_id_fkey";

alter table "public"."exams" add constraint "exams_math_scoring_curve_id_fkey" FOREIGN KEY (math_scoring_curve_id) REFERENCES scoring_curves(id) not valid;

alter table "public"."exams" validate constraint "exams_math_scoring_curve_id_fkey";

alter table "public"."exams" add constraint "exams_scoring_curve_id_fkey" FOREIGN KEY (scoring_curve_id) REFERENCES scoring_curves(id) not valid;

alter table "public"."exams" validate constraint "exams_scoring_curve_id_fkey";

alter table "public"."exams" add constraint "fk_exams_template_id" FOREIGN KEY (template_id) REFERENCES exam_templates(id) not valid;

alter table "public"."exams" validate constraint "fk_exams_template_id";

alter table "public"."questions" add constraint "questions_correct_answer_format_check" CHECK ((((question_type = 'grid_in'::question_type) AND (correct_answers IS NOT NULL)) OR ((question_type = 'multiple_choice'::question_type) AND (correct_answer IS NOT NULL)) OR (question_type = 'essay'::question_type))) not valid;

alter table "public"."questions" validate constraint "questions_correct_answer_format_check";

alter table "public"."questions" add constraint "questions_exam_id_module_type_question_number_key" UNIQUE using index "questions_exam_id_module_type_question_number_key";

alter table "public"."regrade_history" add constraint "regrade_history_admin_id_fkey" FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."regrade_history" validate constraint "regrade_history_admin_id_fkey";

alter table "public"."regrade_history" add constraint "regrade_history_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES test_attempts(id) ON DELETE CASCADE not valid;

alter table "public"."regrade_history" validate constraint "regrade_history_attempt_id_fkey";

alter table "public"."regrade_history" add constraint "regrade_history_user_answer_id_fkey" FOREIGN KEY (user_answer_id) REFERENCES user_answers(id) ON DELETE CASCADE not valid;

alter table "public"."regrade_history" validate constraint "regrade_history_user_answer_id_fkey";

alter table "public"."scoring_curves" add constraint "scoring_curves_curve_name_key" UNIQUE using index "scoring_curves_curve_name_key";

alter table "public"."user_profiles" add constraint "user_profiles_grade_level_check" CHECK (((grade_level >= 9) AND (grade_level <= 12))) not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_grade_level_check";

alter table "public"."user_profiles" add constraint "user_profiles_target_score_check" CHECK (((target_score >= 400) AND (target_score <= 1600))) not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_target_score_check";

alter table "public"."exam_assignments" add constraint "exam_assignments_assigned_by_fkey" FOREIGN KEY (assigned_by) REFERENCES auth.users(id) not valid;

alter table "public"."exam_assignments" validate constraint "exam_assignments_assigned_by_fkey";

alter table "public"."exams" add constraint "exams_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."exams" validate constraint "exams_created_by_fkey";

alter table "public"."user_profiles" add constraint "user_profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_user_auth_status()
 RETURNS TABLE(property text, value text, is_valid boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_emergency_bypass_policy()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_practice_session(target_user_id uuid, module_name text DEFAULT 'english1'::text, is_single_question boolean DEFAULT false)
 RETURNS TABLE(success boolean, attempt_id uuid, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.debug_current_user_test_attempt()
 RETURNS TABLE(step text, value text, success boolean, details text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.debug_exam_access(exam_uuid uuid)
 RETURNS TABLE(check_name text, result boolean, details text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.debug_practice_creation(test_user_id uuid)
 RETURNS TABLE(step text, success boolean, auth_uid_value uuid, provided_user_id uuid, ids_match boolean, user_profile_exists boolean, error_details text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.debug_rls_bypass_test(exam_uuid uuid)
 RETURNS TABLE(test_name text, success boolean, error_msg text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.debug_test_attempt_creation(target_user_id uuid, target_exam_id uuid, is_practice boolean DEFAULT false)
 RETURNS TABLE(step text, success boolean, current_auth_uid uuid, provided_user_id uuid, provided_exam_id uuid, ids_match boolean, error_details text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.delete_exam_and_all_data(p_exam_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- For safety and feedback, we will log what we are doing.
    RAISE NOTICE 'Starting deletion process for exam_id: %', p_exam_id;

    -- IMPORTANT WARNING: The following steps will delete questions from your main question bank
    -- that are associated with this exam. This is a DESTRUCTIVE action.
    -- If you only want to "unpublish" the exam but keep the questions,
    -- you should remove the DELETE statements for 'mistake_bank' and 'questions'.

    -- Step 1 & 5: Delete mistake bank entries and user answers for questions in this exam.
    -- This must be done before deleting the questions themselves.
    RAISE NOTICE 'Deleting associated mistake_bank entries...';
    DELETE FROM public.mistake_bank WHERE question_id IN (SELECT question_id FROM public.exam_questions WHERE exam_id = p_exam_id);
    
    RAISE NOTICE 'Deleting associated user_answers...';
    DELETE FROM public.user_answers WHERE question_id IN (SELECT question_id FROM public.exam_questions WHERE exam_id = p_exam_id);

    -- Step 2: Delete test attempts associated with this exam.
    RAISE NOTICE 'Deleting associated test_attempts...';
    DELETE FROM public.test_attempts WHERE exam_id = p_exam_id;

    -- Step 3: Delete exam assignments associated with this exam.
    RAISE NOTICE 'Deleting associated exam_assignments...';
    DELETE FROM public.exam_assignments WHERE exam_id = p_exam_id;

    -- Step 6: Delete the questions themselves that are part of this exam.
    -- DANGER: This assumes questions are exclusive to one exam composition. If questions are reused,
    -- you might want to comment out this section and only delete the links (exam_questions).
    RAISE NOTICE 'Deleting associated questions from the question bank...';
    DELETE FROM public.questions WHERE id IN (SELECT question_id FROM public.exam_questions WHERE exam_id = p_exam_id);

    -- Step 4: Delete the links in the junction table.
    -- This is now redundant if the questions are deleted, but good practice to keep.
    RAISE NOTICE 'Deleting exam_questions links...';
    DELETE FROM public.exam_questions WHERE exam_id = p_exam_id;

    -- Step 7: Finally, delete the exam itself.
    RAISE NOTICE 'Deleting the exam record itself...';
    DELETE FROM public.exams WHERE id = p_exam_id;

    RAISE NOTICE 'Deletion process completed for exam_id: %', p_exam_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_exams_by_keyword(p_keyword text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    target_exam_ids UUID[];
    deleted_count INT;
BEGIN
    RAISE NOTICE 'Searching for exams with keyword "%" in title OR description...', p_keyword;

    -- 1. title 또는 description에 키워드를 포함하는 모든 exam의 ID를 찾습니다.
    --    이 부분이 업그레이드되었습니다.
    SELECT ARRAY_AGG(id) INTO target_exam_ids 
    FROM public.exams 
    WHERE title ILIKE '%' || p_keyword || '%' OR description ILIKE '%' || p_keyword || '%';

    -- 만약 해당하는 시험이 없으면, 함수를 종료합니다.
    IF target_exam_ids IS NULL OR array_length(target_exam_ids, 1) = 0 THEN
        RAISE NOTICE 'No exams found with the specified keyword.';
        RETURN 'No exams found to delete.';
    END IF;
    
    deleted_count := array_length(target_exam_ids, 1);
    RAISE NOTICE 'Found % exams to delete. Starting deletion process...', deleted_count;

    -- 2. 관련된 모든 자식 테이블의 데이터를 삭제합니다. (이하 로직은 동일)
    
    RAISE NOTICE 'Deleting associated mistake_bank and user_answers entries...';
    DELETE FROM public.mistake_bank WHERE question_id IN (SELECT question_id FROM public.exam_questions WHERE exam_id = ANY(target_exam_ids));
    DELETE FROM public.user_answers WHERE question_id IN (SELECT question_id FROM public.exam_questions WHERE exam_id = ANY(target_exam_ids));
    
    RAISE NOTICE 'Deleting associated test_attempts...';
    DELETE FROM public.test_attempts WHERE exam_id = ANY(target_exam_ids);

    RAISE NOTICE 'Deleting associated exam_assignments...';
    DELETE FROM public.exam_assignments WHERE exam_id = ANY(target_exam_ids);

    RAISE NOTICE 'Deleting associated questions...';
    DELETE FROM public.questions WHERE id IN (SELECT question_id FROM public.exam_questions WHERE exam_id = ANY(target_exam_ids));

    RAISE NOTICE 'Deleting exam_questions links...';
    DELETE FROM public.exam_questions WHERE exam_id = ANY(target_exam_ids);

    RAISE NOTICE 'Deleting the exam records themselves...';
    DELETE FROM public.exams WHERE id = ANY(target_exam_ids);

    RAISE NOTICE 'Deletion process completed. % exams and their related data were deleted.', deleted_count;

    RETURN deleted_count || ' exams and their related data were successfully deleted.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_exams_by_title_keyword(p_keyword text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    -- 삭제될 exam_id들을 저장할 변수를 선언합니다.
    target_exam_ids UUID[];
    deleted_count INT;
BEGIN
    RAISE NOTICE 'Searching for exams with keyword: %', p_keyword;

    -- 1. 키워드를 포함하는 모든 exam의 ID를 찾아서 배열 변수에 저장합니다.
    SELECT ARRAY_AGG(id) INTO target_exam_ids FROM public.exams WHERE title ILIKE '%' || p_keyword || '%';

    -- 만약 해당하는 시험이 없으면, 메시지를 반환하고 함수를 종료합니다.
    IF target_exam_ids IS NULL OR array_length(target_exam_ids, 1) = 0 THEN
        RAISE NOTICE 'No exams found with the specified keyword.';
        RETURN 'No exams found to delete.';
    END IF;
    
    deleted_count := array_length(target_exam_ids, 1);
    RAISE NOTICE 'Found % exams to delete. Starting deletion process...', deleted_count;

    -- 2. 관련된 모든 자식 테이블의 데이터를 삭제합니다. (순서가 매우 중요)
    
    -- mistake_bank, user_answers (questions를 통해 연결)
    RAISE NOTICE 'Deleting associated mistake_bank and user_answers entries...';
    DELETE FROM public.mistake_bank WHERE question_id IN (SELECT question_id FROM public.exam_questions WHERE exam_id = ANY(target_exam_ids));
    DELETE FROM public.user_answers WHERE question_id IN (SELECT question_id FROM public.exam_questions WHERE exam_id = ANY(target_exam_ids));
    
    -- test_attempts
    RAISE NOTICE 'Deleting associated test_attempts...';
    DELETE FROM public.test_attempts WHERE exam_id = ANY(target_exam_ids);

    -- exam_assignments
    RAISE NOTICE 'Deleting associated exam_assignments...';
    DELETE FROM public.exam_assignments WHERE exam_id = ANY(target_exam_ids);

    -- questions (exam_questions를 통해 연결)
    -- DANGER: 이 시험들에만 포함된 문제들이 삭제됩니다.
    RAISE NOTICE 'Deleting associated questions...';
    DELETE FROM public.questions WHERE id IN (SELECT question_id FROM public.exam_questions WHERE exam_id = ANY(target_exam_ids));

    -- exam_questions (연결고리)
    RAISE NOTICE 'Deleting exam_questions links...';
    DELETE FROM public.exam_questions WHERE exam_id = ANY(target_exam_ids);

    -- 3. 마지막으로, exams 테이블 자체에서 해당 레코드들을 삭제합니다.
    RAISE NOTICE 'Deleting the exam records themselves...';
    DELETE FROM public.exams WHERE id = ANY(target_exam_ids);

    RAISE NOTICE 'Deletion process completed. % exams and their related data were deleted.', deleted_count;

    -- 성공 메시지를 반환합니다.
    RETURN deleted_count || ' exams and their related data were successfully deleted.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.migrate_grid_in_answers()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.test_auth_uid()
 RETURNS TABLE(current_auth_uid uuid, current_auth_role text, auth_user_exists boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        auth.uid() as current_auth_uid,
        auth.role() as current_auth_role,
        (auth.uid() IS NOT NULL) as auth_user_exists;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.test_practice_insert(test_user_id uuid)
 RETURNS TABLE(success boolean, attempt_id uuid, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.test_questions_access()
 RETURNS TABLE(test_name text, success boolean, count_result integer, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.test_rls_fix(exam_uuid uuid)
 RETURNS TABLE(test_name text, success boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_questions_access()
 RETURNS TABLE(test_description text, success boolean, result_count integer, user_role text, auth_uid text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.verify_test_attempt_rls()
 RETURNS TABLE(auth_uid uuid, can_create_regular_attempt boolean, can_create_practice_attempt boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_exams_list()
 RETURNS TABLE(id uuid, title character varying, description text, created_at timestamp with time zone, is_active boolean, total_questions integer, english_curve_id integer, math_curve_id integer, english_curve_name text, math_curve_name text, latest_attempt_visibility boolean, latest_attempt_visible_after timestamp with time zone, total_attempts_count bigint, template_id text, is_custom_assignment boolean, exam_type text)
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_report_attempts()
 RETURNS TABLE(attempt_id uuid, completed_at timestamp with time zone, duration_seconds bigint, final_scores jsonb, student_id uuid, student_full_name character varying, student_email character varying, exam_id uuid, exam_title character varying)
 LANGUAGE plpgsql
AS $function$
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
$function$
;

create type "public"."quiz_result_input" as ("entry_id" bigint, "was_correct" boolean);

grant delete on table "public"."regrade_history" to "anon";

grant insert on table "public"."regrade_history" to "anon";

grant references on table "public"."regrade_history" to "anon";

grant select on table "public"."regrade_history" to "anon";

grant trigger on table "public"."regrade_history" to "anon";

grant truncate on table "public"."regrade_history" to "anon";

grant update on table "public"."regrade_history" to "anon";

grant delete on table "public"."regrade_history" to "authenticated";

grant insert on table "public"."regrade_history" to "authenticated";

grant references on table "public"."regrade_history" to "authenticated";

grant select on table "public"."regrade_history" to "authenticated";

grant trigger on table "public"."regrade_history" to "authenticated";

grant truncate on table "public"."regrade_history" to "authenticated";

grant update on table "public"."regrade_history" to "authenticated";

grant delete on table "public"."regrade_history" to "service_role";

grant insert on table "public"."regrade_history" to "service_role";

grant references on table "public"."regrade_history" to "service_role";

grant select on table "public"."regrade_history" to "service_role";

grant trigger on table "public"."regrade_history" to "service_role";

grant truncate on table "public"."regrade_history" to "service_role";

grant update on table "public"."regrade_history" to "service_role";

grant delete on table "public"."scoring_curves" to "anon";

grant insert on table "public"."scoring_curves" to "anon";

grant references on table "public"."scoring_curves" to "anon";

grant select on table "public"."scoring_curves" to "anon";

grant trigger on table "public"."scoring_curves" to "anon";

grant truncate on table "public"."scoring_curves" to "anon";

grant update on table "public"."scoring_curves" to "anon";

grant delete on table "public"."scoring_curves" to "authenticated";

grant insert on table "public"."scoring_curves" to "authenticated";

grant references on table "public"."scoring_curves" to "authenticated";

grant select on table "public"."scoring_curves" to "authenticated";

grant trigger on table "public"."scoring_curves" to "authenticated";

grant truncate on table "public"."scoring_curves" to "authenticated";

grant update on table "public"."scoring_curves" to "authenticated";

grant delete on table "public"."scoring_curves" to "service_role";

grant insert on table "public"."scoring_curves" to "service_role";

grant references on table "public"."scoring_curves" to "service_role";

grant select on table "public"."scoring_curves" to "service_role";

grant trigger on table "public"."scoring_curves" to "service_role";

grant truncate on table "public"."scoring_curves" to "service_role";

grant update on table "public"."scoring_curves" to "service_role";

create policy "Admins can create exams"
on "public"."exams"
as permissive
for insert
to public
with check (is_admin(auth.uid()));


create policy "Admins can delete exams"
on "public"."exams"
as permissive
for delete
to public
using (is_admin(auth.uid()));


create policy "Admins can update exams"
on "public"."exams"
as permissive
for update
to public
using (is_admin(auth.uid()));


create policy "Admins can view all exams"
on "public"."exams"
as permissive
for select
to public
using (is_admin(auth.uid()));


create policy "Allow anon read access to exams"
on "public"."exams"
as permissive
for select
to anon
using (true);


create policy "Users can view active exams"
on "public"."exams"
as permissive
for select
to public
using ((is_active = true));


create policy "questions_admin_delete"
on "public"."questions"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))));


create policy "questions_admin_insert"
on "public"."questions"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))));


create policy "questions_admin_update"
on "public"."questions"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))));


create policy "questions_read_access"
on "public"."questions"
as permissive
for select
to public
using ((auth.uid() IS NOT NULL));


create policy "Admin users can insert regrade history"
on "public"."regrade_history"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))));


create policy "Admin users can view regrade history"
on "public"."regrade_history"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))));


create policy "Allow anon read access to test_attempts"
on "public"."test_attempts"
as permissive
for select
to anon
using (true);


create policy "test_attempts_delete_policy"
on "public"."test_attempts"
as permissive
for delete
to public
using (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role))))));


create policy "test_attempts_insert_policy"
on "public"."test_attempts"
as permissive
for insert
to public
with check (((auth.uid() IS NOT NULL) AND (((user_id = auth.uid()) AND (( SELECT (NOT COALESCE(exams.is_custom_assignment, false))
   FROM exams
  WHERE (exams.id = test_attempts.exam_id)) OR (( SELECT COALESCE(exams.is_custom_assignment, false) AS "coalesce"
   FROM exams
  WHERE (exams.id = test_attempts.exam_id)) AND (EXISTS ( SELECT 1
   FROM exam_assignments
  WHERE ((exam_assignments.exam_id = test_attempts.exam_id) AND (exam_assignments.student_id = auth.uid()) AND (exam_assignments.is_active = true))))) OR (is_practice_mode = true))) OR ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))) AND (( SELECT (NOT COALESCE(exams.is_custom_assignment, false))
   FROM exams
  WHERE (exams.id = test_attempts.exam_id)) OR (( SELECT COALESCE(exams.is_custom_assignment, false) AS "coalesce"
   FROM exams
  WHERE (exams.id = test_attempts.exam_id)) AND (EXISTS ( SELECT 1
   FROM exam_assignments
  WHERE ((exam_assignments.exam_id = test_attempts.exam_id) AND (exam_assignments.student_id = test_attempts.user_id) AND (exam_assignments.is_active = true))))) OR (is_practice_mode = true))))));


create policy "test_attempts_select_policy"
on "public"."test_attempts"
as permissive
for select
to public
using (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role))))));


create policy "test_attempts_update_policy"
on "public"."test_attempts"
as permissive
for update
to public
using (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role))))));


create policy "Admin users can update all answers"
on "public"."user_answers"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))));


create policy "Admin users can view all answers"
on "public"."user_answers"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))));


create policy "Users can insert their own answers"
on "public"."user_answers"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM test_attempts
  WHERE ((test_attempts.id = user_answers.attempt_id) AND (test_attempts.user_id = auth.uid())))));


create policy "Users can update their own answers"
on "public"."user_answers"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM test_attempts
  WHERE ((test_attempts.id = user_answers.attempt_id) AND (test_attempts.user_id = auth.uid())))));


create policy "Users can view their own answers"
on "public"."user_answers"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM test_attempts
  WHERE ((test_attempts.id = user_answers.attempt_id) AND (test_attempts.user_id = auth.uid())))));


create policy "Admins can delete profiles"
on "public"."user_profiles"
as permissive
for delete
to public
using (is_admin(auth.uid()));


create policy "Admins can update any profile"
on "public"."user_profiles"
as permissive
for update
to public
using (is_admin(auth.uid()));


create policy "Allow anon read access to user_profiles"
on "public"."user_profiles"
as permissive
for select
to anon
using (true);


create policy "Authenticated users can create profile"
on "public"."user_profiles"
as permissive
for insert
to public
with check ((auth.uid() = id));


create policy "authenticated_users_read_own_profile"
on "public"."user_profiles"
as permissive
for select
to public
using (((auth.uid() IS NOT NULL) AND (auth.uid() = id)));


create policy "user_profiles_read_own"
on "public"."user_profiles"
as permissive
for select
to public
using ((auth.uid() = id));


create policy "users_read_own_profile"
on "public"."user_profiles"
as permissive
for select
to public
using ((auth.uid() = id));


create policy "Admins can manage exam questions"
on "public"."exam_questions"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))))
with check ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))));


create policy "Admins can manage exam templates"
on "public"."exam_templates"
as permissive
for all
to public
using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))));


create policy "Admins can insert mistakes for any user"
on "public"."mistake_bank"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))));


create policy "Admins can update any mistakes"
on "public"."mistake_bank"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))));


create policy "Admins can view all mistakes"
on "public"."mistake_bank"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::user_role)))));


create policy "Admins can view all profiles"
on "public"."user_profiles"
as permissive
for select
to public
using (is_admin(auth.uid()));


CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_attempts_updated_at BEFORE UPDATE ON public.test_attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


