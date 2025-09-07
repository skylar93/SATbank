const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testAuthenticatedAccess() {
  console.log('🔍 Testing authenticated access...');
  
  const supabase = createClient(supabaseUrl, anonKey);
  
  try {
    // Try to sign in with admin credentials
    console.log('🔑 Signing in as admin...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@admin.sat',
      password: 'adminpassword'
    });
    
    if (authError) {
      console.error('❌ Auth error:', authError.message);
      console.log('💡 Try different password? Common ones: password, admin, adminpassword');
      return;
    }
    
    console.log('✅ Signed in successfully:', authData.user?.email);
    
    // Now test queries with authenticated context
    console.log('📊 Testing user_profiles with auth...');
    const { data: students, error: studentsError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, role')
      .eq('role', 'student');
      
    if (studentsError) {
      console.error('❌ Students query error:', studentsError.message);
    } else {
      console.log('✅ Students query returned', students?.length || 0, 'records');
    }
    
    console.log('📊 Testing test_attempts with auth...');
    const { data: attempts, error: attemptsError } = await supabase
      .from('test_attempts')
      .select('id, user_id, exam_id, status')
      .eq('status', 'completed')
      .limit(3);
      
    if (attemptsError) {
      console.error('❌ Attempts query error:', attemptsError.message);
    } else {
      console.log('✅ Attempts query returned', attempts?.length || 0, 'records');
    }
    
    console.log('📊 Testing RPC with auth...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_admin_report_attempts');
    
    if (rpcError) {
      console.error('❌ RPC error:', rpcError.message);
    } else {
      console.log('✅ RPC returned', rpcData?.length || 0, 'records');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAuthenticatedAccess().catch(console.error);