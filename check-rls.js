const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkRLS() {
  console.log('🔍 Checking RLS policies...');
  
  try {
    // Check RLS policies for user_profiles
    const { data: userPolicies, error: userPoliciesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'user_profiles');
      
    if (userPoliciesError) {
      console.error('❌ Error checking user_profiles policies:', userPoliciesError.message);
    } else {
      console.log('📋 user_profiles RLS policies:');
      userPolicies?.forEach(policy => {
        console.log(`  - ${policy.policyname}: ${policy.qual}`);
      });
    }
    
    // Check RLS policies for test_attempts
    const { data: attemptPolicies, error: attemptPoliciesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'test_attempts');
      
    if (attemptPoliciesError) {
      console.error('❌ Error checking test_attempts policies:', attemptPoliciesError.message);
    } else {
      console.log('📋 test_attempts RLS policies:');
      attemptPolicies?.forEach(policy => {
        console.log(`  - ${policy.policyname}: ${policy.qual}`);
      });
    }
    
    // Check if RLS is enabled
    const { data: tables, error: tablesError } = await supabase
      .from('pg_tables')
      .select('tablename, rowsecurity')
      .in('tablename', ['user_profiles', 'test_attempts']);
      
    if (tablesError) {
      console.error('❌ Error checking table settings:', tablesError.message);
    } else {
      console.log('📋 Table RLS settings:');
      tables?.forEach(table => {
        console.log(`  - ${table.tablename}: RLS ${table.rowsecurity ? 'ENABLED' : 'DISABLED'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkRLS().catch(console.error);