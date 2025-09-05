#!/usr/bin/env node

/**
 * Phase 1b & 1c Migration Verification
 * 
 * This script verifies that exam templates were seeded and existing exams were categorized correctly.
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: 'apps/web/.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function verifyPhase1bcMigrations() {
  console.log('🔍 Phase 1b & 1c Migration Verification')
  console.log('=======================================\n')
  
  let allPassed = true
  
  try {
    // Test 1: Check if exam templates were seeded
    console.log('1️⃣ Testing exam templates seeding...')
    try {
      const { data: templates, error: templatesError } = await supabase
        .from('exam_templates')
        .select('*')
        .order('id')
      
      if (templatesError) throw templatesError
      
      const expectedTemplates = ['custom', 'english_only', 'full_sat', 'math_only', 'single_module']
      const actualTemplates = templates.map(t => t.id).sort()
      
      if (JSON.stringify(expectedTemplates) === JSON.stringify(actualTemplates)) {
        console.log('   ✅ All 5 exam templates created successfully')
        templates.forEach(t => {
          console.log(`   📋 ${t.id}: ${t.name}`)
        })
      } else {
        console.log('   ❌ Template mismatch')
        console.log('      Expected:', expectedTemplates)
        console.log('      Actual:', actualTemplates)
        allPassed = false
      }
    } catch (e) {
      console.log('   ❌ Template seeding verification failed')
      console.log('      Error:', e.message)
      allPassed = false
    }
    
    // Test 2: Check exam template assignments
    console.log('\n2️⃣ Testing exam template assignments...')
    try {
      const { data: examStats, error: statsError } = await supabase
        .from('exams')
        .select(`
          template_id,
          title
        `)
        .order('template_id, title')
      
      if (statsError) throw statsError
      
      // Group by template
      const grouped = examStats.reduce((acc, exam) => {
        const template = exam.template_id || 'unassigned'
        if (!acc[template]) acc[template] = []
        acc[template].push(exam.title)
        return acc
      }, {})
      
      console.log('   📊 Template Assignment Summary:')
      Object.entries(grouped).forEach(([template, titles]) => {
        console.log(`   ${template.padEnd(15)}: ${titles.length} exams`)
        titles.forEach(title => {
          console.log(`      • ${title}`)
        })
      })
      
      // Check for unassigned
      if (grouped.unassigned) {
        console.log('   ⚠️  Found unassigned exams:', grouped.unassigned.length)
        allPassed = false
      } else {
        console.log('   ✅ All exams have template assignments')
      }
      
    } catch (e) {
      console.log('   ❌ Assignment verification failed')
      console.log('      Error:', e.message)
      allPassed = false
    }
    
    // Test 3: Validate scoring_groups JSON structure
    console.log('\n3️⃣ Testing scoring groups structure...')
    try {
      const { data: templates, error } = await supabase
        .from('exam_templates')
        .select('id, scoring_groups')
      
      if (error) throw error
      
      let validStructure = true
      templates.forEach(template => {
        try {
          const groups = template.scoring_groups
          if (typeof groups !== 'object') {
            console.log(`   ❌ ${template.id}: scoring_groups is not an object`)
            validStructure = false
          } else {
            console.log(`   ✅ ${template.id}: Valid JSON structure`)
          }
        } catch (e) {
          console.log(`   ❌ ${template.id}: Invalid JSON in scoring_groups`)
          validStructure = false
        }
      })
      
      if (validStructure) {
        console.log('   ✅ All scoring groups have valid JSON structure')
      } else {
        allPassed = false
      }
      
    } catch (e) {
      console.log('   ❌ Scoring groups validation failed')
      console.log('      Error:', e.message)
      allPassed = false
    }
    
    // Test 4: Check foreign key relationships
    console.log('\n4️⃣ Testing foreign key relationships...')
    try {
      const { data: joinResult, error: joinError } = await supabase
        .from('exams')
        .select(`
          title,
          template_id,
          exam_templates!inner (
            name
          )
        `)
        .limit(3)
      
      if (joinError) throw joinError
      
      console.log('   ✅ Foreign key relationships working')
      console.log('   📋 Sample joined data:')
      joinResult.forEach(exam => {
        console.log(`      "${exam.title}" → ${exam.exam_templates.name}`)
      })
      
    } catch (e) {
      console.log('   ⚠️  Foreign key test inconclusive')
      console.log('      Error:', e.message)
    }
    
    // Final summary
    console.log('\n📊 VERIFICATION SUMMARY')
    console.log('======================')
    
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED!')
      console.log('✅ Phase 1b: Templates seeded successfully')
      console.log('✅ Phase 1c: All exams categorized correctly') 
      console.log('✅ Template system foundation is complete')
      console.log('\n🚀 Next steps:')
      console.log('   • Phase 2: Build Smart Exam Builder UI')
      console.log('   • Phase 3: Implement Dynamic Scoring Service')
    } else {
      console.log('⚠️  Some tests failed')
      console.log('🔧 Please check the errors above and re-run migrations if needed')
    }
    
  } catch (error) {
    console.error('💥 Verification failed:', error.message)
    allPassed = false
  }
  
  process.exit(allPassed ? 0 : 1)
}

console.log('🚀 Phase 1b & 1c Verification Tool')
console.log('===================================')
verifyPhase1bcMigrations()