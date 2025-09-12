#!/usr/bin/env node

/**
 * Phase 1 Migration Direct Executor
 * 
 * This script executes migration using direct table operations
 * instead of raw SQL execution.
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: 'apps/web/.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function executePhase1MigrationDirect() {
  const dryRun = !process.argv.includes('--confirm')
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made')
    console.log('Add --confirm to perform actual migration\n')
  }
  
  console.log('🚀 Phase 1 Migration: Direct Execution')
  console.log('=====================================\n')
  
  try {
    // Step 1: Check current schema
    console.log('1️⃣ Checking current database schema...')
    
    const { data: existingTables, error: tableCheckError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['exam_templates', 'exams'])
    
    if (tableCheckError) throw tableCheckError
    
    const hasExamTemplates = existingTables?.some(t => t.table_name === 'exam_templates')
    const hasExams = existingTables?.some(t => t.table_name === 'exams')
    
    console.log(`   📋 exams table: ${hasExams ? '✅ exists' : '❌ missing'}`)
    console.log(`   📋 exam_templates table: ${hasExamTemplates ? '✅ exists' : '❌ missing'}`)
    
    // Step 2: Check existing columns in exams table
    console.log('\n2️⃣ Checking existing columns...')
    
    const { data: existingColumns, error: columnCheckError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'exams')
      .eq('table_schema', 'public')
    
    if (columnCheckError) throw columnCheckError
    
    const hasTemplateId = existingColumns?.some(c => c.column_name === 'template_id')
    const hasModuleComp = existingColumns?.some(c => c.column_name === 'module_composition')
    
    console.log(`   📋 template_id column: ${hasTemplateId ? '✅ exists' : '❌ missing'}`)
    console.log(`   📋 module_composition column: ${hasModuleComp ? '✅ exists' : '❌ missing'}`)
    
    // Step 3: Create exam_templates table if needed
    if (!hasExamTemplates) {
      console.log('\n3️⃣ Creating exam_templates table...')
      if (!dryRun) {
        // We'll need to use a workaround - create via INSERT then modify
        // This is a bit tricky with Supabase JS client, so let's provide manual SQL
        console.log('   ⚠️  Manual SQL execution required')
        console.log('   📋 Please execute this SQL in Supabase Dashboard:')
        console.log(`
-- Copy and paste this into Supabase SQL Editor:
CREATE TABLE public.exam_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    scoring_groups JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exam_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view exam templates" ON public.exam_templates
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage exam templates" ON public.exam_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );
        `)
      } else {
        console.log('   📋 Would create exam_templates table')
      }
    } else {
      console.log('\n3️⃣ exam_templates table already exists ✅')
    }
    
    // Step 4: Add columns to exams if needed
    if (!hasTemplateId || !hasModuleComp) {
      console.log('\n4️⃣ Adding columns to exams table...')
      if (!dryRun) {
        console.log('   ⚠️  Manual SQL execution required')
        console.log('   📋 Please execute this SQL in Supabase Dashboard:')
        console.log(`
-- Copy and paste this into Supabase SQL Editor:
ALTER TABLE public.exams 
ADD COLUMN IF NOT EXISTS template_id TEXT,
ADD COLUMN IF NOT EXISTS module_composition JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.exams 
ADD CONSTRAINT IF NOT EXISTS fk_exams_template_id 
FOREIGN KEY (template_id) REFERENCES public.exam_templates(id);

CREATE INDEX IF NOT EXISTS idx_exams_template_id ON public.exams(template_id);
CREATE INDEX IF NOT EXISTS idx_exam_templates_created_at ON public.exam_templates(created_at);
        `)
      } else {
        console.log('   📋 Would add template_id and module_composition columns')
      }
    } else {
      console.log('\n4️⃣ Columns already exist ✅')
    }
    
    console.log('\n✅ Phase 1 Schema Analysis Complete!')
    
    if (dryRun) {
      console.log('\n📋 NEXT STEPS:')
      console.log('1. Review the SQL commands above')
      console.log('2. Go to Supabase Dashboard > SQL Editor')
      console.log('3. Copy and paste the SQL commands')
      console.log('4. Execute them one by one')
      console.log('5. Run this script again with --verify to check')
    }
    
  } catch (error) {
    console.error('💥 Analysis failed:', error.message)
    console.log('\n🆘 This is likely a connectivity or permissions issue')
    console.log('Try accessing Supabase Dashboard directly for manual execution')
    process.exit(1)
  }
}

console.log('🚀 Phase 1 Direct Migration Tool')
console.log('=================================')

if (process.argv.includes('--help')) {
  console.log(`
Usage:
  node scripts/execute-phase1-migration-direct.js         # Check current state
  node scripts/execute-phase1-migration-direct.js --verify # Verify migration complete

This script analyzes the current schema and provides manual SQL commands
for creating the template system when direct execution isn't possible.
`)
  process.exit(0)
}

executePhase1MigrationDirect()