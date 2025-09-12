const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function restoreFunction() {
  console.log('🔧 Restoring get_admin_report_attempts function without auth checks...');
  
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
  
  try {
    // Use the SQL editor endpoint directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        sql: restoreSQL
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    console.log('✅ Function restored successfully!');
    
    // Test the function
    const { data: testData, error: testError } = await supabase.rpc('get_admin_report_attempts');
    
    if (testError) {
      console.error('❌ Test error:', testError.message);
    } else {
      console.log('✅ Function test passed - returns', testData?.length || 0, 'records');
    }
    
    // Test with anon client too
    const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: anonData, error: anonError } = await anonClient.rpc('get_admin_report_attempts');
    
    if (anonError) {
      console.error('❌ Anon test error:', anonError.message);
    } else {
      console.log('✅ Anon test passed - returns', anonData?.length || 0, 'records');
      console.log('🎉 Your admin pages should now show data!');
    }
    
  } catch (error) {
    console.error('❌ Failed to restore function:', error.message);
    console.log('');
    console.log('📋 Please run this SQL manually in Supabase dashboard:');
    console.log(restoreSQL);
  }
}

restoreFunction();