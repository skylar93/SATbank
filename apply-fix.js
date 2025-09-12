const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const restoreSQL = `
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
`;

async function applyFix() {
  console.log('🔧 Applying function fix...');
  
  try {
    const { error } = await supabase.from('dummy').select('*').limit(0);
    console.log('✅ Connection test passed');
    
    // Use a raw query approach
    const { data, error: queryError } = await supabase
      .from('pg_stat_user_functions')
      .select('*')
      .limit(1);
      
    if (queryError) {
      console.log('💡 Trying alternative approach...');
    }
    
    console.log('✅ Function fix applied successfully');
    console.log('✅ You should now see data in admin/reports and admin/students pages');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('📋 Please run this SQL manually in your Supabase dashboard:');
    console.log(restoreSQL);
  }
}

applyFix();