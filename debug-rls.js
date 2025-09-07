const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './apps/web/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function debugRLS() {
  console.log('🔍 Debugging RLS policies...');
  
  // Check RLS status and policies using raw SQL
  const queries = [
    {
      name: 'Check user_profiles RLS',
      sql: `
        SELECT schemaname, tablename, rowsecurity 
        FROM pg_tables 
        WHERE tablename = 'user_profiles'
      `
    },
    {
      name: 'Check test_attempts RLS',
      sql: `
        SELECT schemaname, tablename, rowsecurity 
        FROM pg_tables 
        WHERE tablename = 'test_attempts'  
      `
    },
    {
      name: 'List user_profiles policies',
      sql: `
        SELECT policyname, permissive, roles, cmd, qual 
        FROM pg_policies 
        WHERE tablename = 'user_profiles'
      `
    },
    {
      name: 'List test_attempts policies',
      sql: `
        SELECT policyname, permissive, roles, cmd, qual
        FROM pg_policies 
        WHERE tablename = 'test_attempts'
      `
    }
  ];
  
  for (const query of queries) {
    console.log(`\n📋 ${query.name}:`);
    try {
      const { data, error } = await supabase.rpc('exec', { 
        sql: query.sql 
      });
      
      if (error) {
        // Try alternative approach
        console.log('  Trying alternative query method...');
        const result = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey
          },
          body: JSON.stringify({ sql: query.sql })
        });
        
        if (result.ok) {
          const data = await result.json();
          console.log('  ✅', JSON.stringify(data, null, 2));
        } else {
          console.log('  ❌ Failed:', await result.text());
        }
      } else {
        console.log('  ✅', JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.log('  ❌ Error:', err.message);
    }
  }
  
  // Try manual RLS bypass approach
  console.log('\n🔧 Testing RLS bypass...');
  try {
    const bypassSQL = `
      BEGIN;
      SET row_security = OFF;
      SELECT id, full_name, email, role FROM user_profiles LIMIT 3;
      SET row_security = ON;
      COMMIT;
    `;
    
    const { data, error } = await supabase.rpc('exec', { sql: bypassSQL });
    
    if (error) {
      console.log('  ❌ RLS bypass failed:', error.message);
    } else {
      console.log('  ✅ RLS bypass worked:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.log('  ❌ RLS bypass error:', err.message);
  }
}

debugRLS().catch(console.error);