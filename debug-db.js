// Debug database connection and create missing RPC function
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.log('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Also test with anon key to simulate frontend
const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const createFunction = `
CREATE OR REPLACE FUNCTION "public"."get_admin_report_attempts"() RETURNS TABLE("attempt_id" "uuid", "completed_at" timestamp with time zone, "duration_seconds" bigint, "final_scores" "jsonb", "student_id" "uuid", "student_full_name" character varying, "student_email" character varying, "exam_id" "uuid", "exam_title" character varying)
    LANGUAGE "plpgsql" SECURITY DEFINER
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
`;

async function debugDatabase() {
  console.log('🔍 Checking database connection...');
  
  // Test basic connection
  const { data: testData, error: testError } = await supabase.from('user_profiles').select('count').single();
  
  if (testError) {
    console.error('❌ Database connection failed:', testError.message);
    return;
  }
  
  console.log('✅ Database connection successful');
  
  // Check if function exists
  console.log('🔍 Checking if get_admin_report_attempts function exists...');
  const { data: functionExists, error: functionError } = await supabase.rpc('get_admin_report_attempts');
  
  if (functionError && functionError.message.includes('function') && functionError.message.includes('does not exist')) {
    console.log('❌ Function does not exist, creating it...');
    
    // Create the function
    const { error: createError } = await supabase.rpc('exec', { sql: createFunction });
    
    if (createError) {
      console.error('❌ Failed to create function with exec:', createError.message);
      console.log('Trying direct SQL execution...');
      
      // Try alternative approach
      const { error: directError } = await supabase.from('_sql').insert({ query: createFunction });
      
      if (directError) {
        console.error('❌ Failed to create function directly:', directError.message);
      }
    } else {
      console.log('✅ Function created successfully');
    }
  } else if (functionError) {
    console.error('❌ Error calling function:', functionError.message);
  } else {
    console.log('✅ Function exists and returned:', functionExists?.length || 0, 'records');
    if (functionExists && functionExists.length > 0) {
      console.log('📊 Sample RPC record:', {
        attempt_id: functionExists[0].attempt_id,
        student_name: functionExists[0].student_full_name,
        exam_title: functionExists[0].exam_title,
        completed_at: functionExists[0].completed_at
      });
    }
  }
  
  // Check data in tables
  console.log('🔍 Checking test_attempts table...');
  const { data: attempts, error: attemptsError } = await supabase
    .from('test_attempts')
    .select('*')
    .eq('status', 'completed')
    .limit(5);
    
  if (attemptsError) {
    console.error('❌ Error checking test_attempts:', attemptsError.message);
  } else {
    console.log('✅ Found', attempts?.length || 0, 'completed test attempts');
    if (attempts && attempts.length > 0) {
      console.log('📊 Sample attempt:', {
        id: attempts[0].id,
        user_id: attempts[0].user_id,
        exam_id: attempts[0].exam_id,
        status: attempts[0].status,
        completed_at: attempts[0].completed_at
      });
    }
  }
  
  // Check user_profiles
  console.log('🔍 Checking user_profiles table...');
  const { data: users, error: usersError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(5);
    
  if (usersError) {
    console.error('❌ Error checking user_profiles:', usersError.message);
  } else {
    console.log('✅ Found', users?.length || 0, 'user profiles');
    if (users && users.length > 0) {
      console.log('📊 Sample user:', {
        id: users[0].id,
        full_name: users[0].full_name,
        email: users[0].email,
        role: users[0].role
      });
    }
  }
  
  // Update the function with new security rules
  console.log('🔧 Updating function with security rules...');
  const { error: updateError } = await supabase.rpc('exec', { sql: createFunction });
  
  if (updateError) {
    console.error('❌ Failed to update function:', updateError.message);
  } else {
    console.log('✅ Function updated with admin checks');
  }
  
  // Test with anon client (simulate frontend)
  console.log('🔍 Testing with anon client (simulating frontend)...');
  const { data: anonRpcData, error: anonRpcError } = await supabaseAnon.rpc('get_admin_report_attempts');
  
  if (anonRpcError) {
    console.error('❌ Anon RPC function error:', anonRpcError.message);
    console.error('This is expected now - function requires admin authentication');
  } else {
    console.log('✅ Anon RPC function returned', anonRpcData?.length || 0, 'records');
  }
  
  // Find admin@admin.sat user
  console.log('🔍 Looking for admin@admin.sat user...');
  const { data: adminUser, error: adminError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', 'admin@admin.sat')
    .single();
    
  if (adminError) {
    console.error('❌ Error finding admin@admin.sat user:', adminError.message);
  } else if (adminUser) {
    console.log('✅ Found admin@admin.sat user:', {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      full_name: adminUser.full_name
    });
  } else {
    console.log('❌ admin@admin.sat user not found');
  }
  
  // Restore original function without authentication check
  console.log('🔧 Restoring original function without auth check...');
  const restoreFunction = `
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
  `;
  
  const { error: restoreError } = await supabase.rpc('exec', { sql: restoreFunction });
  
  if (restoreError) {
    console.error('❌ Failed to restore function:', restoreError.message);
    console.log('');
    console.log('🔧 Please run this SQL in Supabase dashboard to restore:');
    console.log(restoreFunction);
  } else {
    console.log('✅ Function restored to original working state');
  }
}

debugDatabase().catch(console.error);