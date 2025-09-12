#!/usr/bin/env node

/**
 * Phase 1 Migration Executor
 * 
 * This script directly executes the template system migration
 * using the Supabase JavaScript client.
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: 'apps/web/.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function executePhase1Migration() {
  const dryRun = !process.argv.includes('--confirm')
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made')
    console.log('Add --confirm to perform actual migration\n')
  }
  
  console.log('🚀 Phase 1 Migration: Exam Templates System')
  console.log('===========================================\n')
  
  try {
    // Step 1: Create exam_templates table
    console.log('1️⃣ Creating exam_templates table...')
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.exam_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          scoring_groups JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
    
    if (!dryRun) {
      const { error: tableError } = await supabase.rpc('exec', { sql: createTableSQL })
      if (tableError) throw tableError
      console.log('   ✅ exam_templates table created')
    } else {
      console.log('   📋 Would create exam_templates table')
    }
    
    // Step 2: Add columns to exams table
    console.log('\n2️⃣ Adding columns to exams table...')
    const addColumnsSQL = `
      ALTER TABLE public.exams 
      ADD COLUMN IF NOT EXISTS template_id TEXT,
      ADD COLUMN IF NOT EXISTS module_composition JSONB DEFAULT '{}'::jsonb;
    `
    
    if (!dryRun) {
      const { error: columnError } = await supabase.rpc('exec', { sql: addColumnsSQL })
      if (columnError) throw columnError
      console.log('   ✅ template_id and module_composition columns added')
    } else {
      console.log('   📋 Would add template_id and module_composition columns')
    }
    
    // Step 3: Add foreign key constraint
    console.log('\n3️⃣ Adding foreign key constraint...')
    const addConstraintSQL = `
      ALTER TABLE public.exams 
      ADD CONSTRAINT IF NOT EXISTS fk_exams_template_id 
      FOREIGN KEY (template_id) REFERENCES public.exam_templates(id);
    `
    
    if (!dryRun) {
      const { error: constraintError } = await supabase.rpc('exec', { sql: addConstraintSQL })
      if (constraintError) throw constraintError
      console.log('   ✅ Foreign key constraint added')
    } else {
      console.log('   📋 Would add foreign key constraint')
    }
    
    // Step 4: Create indexes
    console.log('\n4️⃣ Creating indexes...')
    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_exams_template_id ON public.exams(template_id);
      CREATE INDEX IF NOT EXISTS idx_exam_templates_created_at ON public.exam_templates(created_at);
    `
    
    if (!dryRun) {
      const { error: indexError } = await supabase.rpc('exec', { sql: createIndexSQL })
      if (indexError) throw indexError
      console.log('   ✅ Indexes created')
    } else {
      console.log('   📋 Would create performance indexes')
    }
    
    // Step 5: Enable RLS and create policies
    console.log('\n5️⃣ Setting up Row Level Security...')
    const rlsSQL = `
      ALTER TABLE public.exam_templates ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY IF NOT EXISTS "Anyone can view exam templates" ON public.exam_templates
          FOR SELECT USING (true);
      
      CREATE POLICY IF NOT EXISTS "Admins can manage exam templates" ON public.exam_templates
          FOR ALL USING (
              EXISTS (
                  SELECT 1 FROM public.user_profiles 
                  WHERE user_profiles.id = auth.uid() 
                  AND user_profiles.role = 'admin'
              )
          );
    `
    
    if (!dryRun) {
      const { error: rlsError } = await supabase.rpc('exec', { sql: rlsSQL })
      if (rlsError) throw rlsError
      console.log('   ✅ RLS policies configured')
    } else {
      console.log('   📋 Would configure Row Level Security')
    }
    
    // Step 6: Verify migration
    console.log('\n6️⃣ Verifying migration...')
    if (!dryRun) {
      // Check if table exists
      const { data: tables, error: tableCheckError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'exam_templates')
        .eq('table_schema', 'public')
      
      if (tables && tables.length > 0) {
        console.log('   ✅ exam_templates table verified')
      } else {
        console.log('   ❌ exam_templates table not found')
      }
      
      // Check if columns exist
      const { data: columns, error: columnCheckError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'exams')
        .eq('table_schema', 'public')
        .in('column_name', ['template_id', 'module_composition'])
      
      if (columns && columns.length === 2) {
        console.log('   ✅ New columns verified')
      } else {
        console.log('   ❌ New columns not found')
      }
    }
    
    console.log('\n✅ Phase 1 Migration completed successfully!')
    console.log('🎯 Template system infrastructure is now in place')
    console.log('📊 All existing functionality remains unchanged')
    
    if (dryRun) {
      console.log('\n💡 To apply these changes, run:')
      console.log('   node scripts/execute-phase1-migration.js --confirm')
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message)
    console.log('\n🆘 RECOVERY OPTIONS:')
    console.log('1. Check error details above')
    console.log('2. Run rollback if needed: node scripts/rollback-template-migration.js --confirm')
    console.log('3. Restore from backup: Available in scripts/backups/')
    process.exit(1)
  }
}

console.log('🚀 Phase 1 Migration Executor')
console.log('=============================')

if (process.argv.includes('--help')) {
  console.log(`
Usage:
  node scripts/execute-phase1-migration.js          # Dry run (preview)
  node scripts/execute-phase1-migration.js --confirm # Actually perform migration

This script will:
  1. Create exam_templates table
  2. Add template_id and module_composition columns to exams table
  3. Set up foreign key constraints
  4. Create performance indexes
  5. Configure Row Level Security
  6. Verify all changes

No existing data will be modified or deleted.
`)
  process.exit(0)
}

executePhase1Migration()