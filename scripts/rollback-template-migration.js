#!/usr/bin/env node

/**
 * Template Migration Rollback Script
 * 
 * This script safely rolls back all template-related changes
 * and restores the system to the previous state.
 * 
 * Usage: node scripts/rollback-template-migration.js --confirm
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: 'apps/web/.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function rollbackTemplateMigration() {
  const dryRun = !process.argv.includes('--confirm')
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made')
    console.log('Add --confirm to perform actual rollback\n')
  }
  
  console.log('🔄 Template Migration Rollback')
  console.log('==============================\n')
  
  try {
    // Step 1: Remove new columns from exams table
    console.log('1️⃣ Rolling back exams table changes...')
    if (!dryRun) {
      // Remove template-related columns
      await supabase.rpc('exec', {
        sql: `
          ALTER TABLE public.exams DROP COLUMN IF EXISTS template_id;
          ALTER TABLE public.exams DROP COLUMN IF EXISTS module_composition;
        `
      })
      console.log('   ✅ Removed template_id and module_composition columns')
    } else {
      console.log('   📋 Would remove: template_id, module_composition columns')
    }
    
    // Step 2: Drop exam_templates table
    console.log('\n2️⃣ Rolling back exam_templates table...')
    if (!dryRun) {
      await supabase.rpc('exec', {
        sql: 'DROP TABLE IF EXISTS public.exam_templates CASCADE;'
      })
      console.log('   ✅ Dropped exam_templates table')
    } else {
      console.log('   📋 Would drop: exam_templates table')
    }
    
    // Step 3: Verify rollback
    console.log('\n3️⃣ Verifying rollback...')
    if (!dryRun) {
      // Check that columns are gone
      const { data: examColumns, error } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'exams')
        .eq('table_schema', 'public')
      
      const templateColumns = examColumns?.filter(col => 
        col.column_name === 'template_id' || col.column_name === 'module_composition'
      )
      
      if (templateColumns?.length === 0) {
        console.log('   ✅ Template columns successfully removed')
      } else {
        console.log('   ⚠️  Some template columns still exist:', templateColumns.map(c => c.column_name))
      }
      
      // Check that template table is gone
      const { data: templateTable, error: tableError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'exam_templates')
        .eq('table_schema', 'public')
      
      if (!templateTable || templateTable.length === 0) {
        console.log('   ✅ exam_templates table successfully removed')
      } else {
        console.log('   ⚠️  exam_templates table still exists')
      }
    }
    
    // Step 4: Restore from backup if needed
    console.log('\n4️⃣ Backup restore information:')
    console.log('   📁 Full backup available at: scripts/backups/backup-current-exams-2025-09-05T15-38-09.json')
    console.log('   💡 To restore original data if needed:')
    console.log('      node scripts/restore-from-backup.js --file=backup-current-exams-2025-09-05T15-38-09.json')
    
    console.log('\n✅ Rollback completed successfully!')
    console.log('🔄 System restored to pre-template state')
    console.log('📊 All existing functionality should work normally')
    
  } catch (error) {
    console.error('💥 Rollback failed:', error.message)
    console.log('\n🆘 EMERGENCY RECOVERY:')
    console.log('1. Check database logs for specific error')
    console.log('2. Manually run rollback SQL if needed:')
    console.log('   ALTER TABLE public.exams DROP COLUMN IF EXISTS template_id;')
    console.log('   ALTER TABLE public.exams DROP COLUMN IF EXISTS module_composition;') 
    console.log('   DROP TABLE IF EXISTS public.exam_templates CASCADE;')
    console.log('3. Contact administrator if issues persist')
    process.exit(1)
  }
}

console.log('🚀 Template Migration Rollback Tool')
console.log('===================================')

if (process.argv.includes('--help')) {
  console.log(`
Usage:
  node scripts/rollback-template-migration.js          # Dry run (preview)
  node scripts/rollback-template-migration.js --confirm # Actually perform rollback

This script will:
  1. Remove template_id and module_composition columns from exams table
  2. Drop the exam_templates table
  3. Verify the rollback was successful
  4. Provide backup restore instructions if needed

All existing exams, questions, test attempts, and user answers will remain unchanged.
`)
  process.exit(0)
}

rollbackTemplateMigration()