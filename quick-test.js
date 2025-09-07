const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, anonKey);

async function testDirectQueries() {
  console.log('🔍 Testing direct table queries (same as frontend)...');
  
  // Test user_profiles query (students page)
  console.log('\n📊 Testing user_profiles query...');
  const { data: students, error: studentsError } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, grade_level, target_score, show_correct_answers, created_at')
    .eq('role', 'student')
    .order('full_name');
    
  if (studentsError) {
    console.error('❌ Students query error:', studentsError.message);
  } else {
    console.log('✅ Students query returned', students?.length || 0, 'records');
    if (students && students.length > 0) {
      console.log('📋 Sample student:', students[0]);
    }
  }
  
  // Test test_attempts query
  console.log('\n📊 Testing test_attempts query...');
  const { data: attempts, error: attemptsError } = await supabase
    .from('test_attempts')
    .select('*')
    .eq('status', 'completed')
    .limit(5);
    
  if (attemptsError) {
    console.error('❌ Attempts query error:', attemptsError.message);
  } else {
    console.log('✅ Attempts query returned', attempts?.length || 0, 'records');
    if (attempts && attempts.length > 0) {
      console.log('📋 Sample attempt:', attempts[0]);
    }
  }
  
  // Test RPC function
  console.log('\n📊 Testing RPC function...');
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_report_attempts');
  
  if (rpcError) {
    console.error('❌ RPC error:', rpcError.message);
  } else {
    console.log('✅ RPC returned', rpcData?.length || 0, 'records');
    if (rpcData && rpcData.length > 0) {
      console.log('📋 Sample RPC record:', rpcData[0]);
    }
  }
}

testDirectQueries().catch(console.error);