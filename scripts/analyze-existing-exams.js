#!/usr/bin/env node

/**
 * Existing Exams Analysis Script
 * 
 * This script analyzes the current exam structure to help plan
 * the migration to template-based architecture.
 * 
 * Usage: node scripts/analyze-existing-exams.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: 'apps/web/.env.local' })

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Please check your environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function analyzeExistingExams() {
  console.log('🔍 Analyzing existing exam structure...')
  
  try {
    // Get all exams with their questions count by module
    const { data: exams, error: examsError } = await supabase
      .from('exams')
      .select(`
        *,
        questions (
          id,
          module_type,
          question_type
        )
      `)
      .order('created_at', { ascending: false })

    if (examsError) {
      throw new Error(`Failed to fetch exams: ${examsError.message}`)
    }

    console.log(`\n📊 Found ${exams.length} existing exams\n`)

    // Detailed analysis
    const templates = {
      full_sat: [],
      english_only: [],
      math_only: [],
      single_module: [],
      partial: [],
      custom: []
    }

    const moduleStats = {
      english1: 0,
      english2: 0,
      math1: 0,
      math2: 0
    }

    exams.forEach((exam, index) => {
      const moduleCount = {}
      exam.questions.forEach(q => {
        moduleCount[q.module_type] = (moduleCount[q.module_type] || 0) + 1
        moduleStats[q.module_type] = (moduleStats[q.module_type] || 0) + 1
      })

      const modules = Object.keys(moduleCount)
      let category = 'custom'
      let template = 'custom'

      // Classify exam by module composition
      if (modules.length === 4 && 
          modules.includes('english1') && modules.includes('english2') && 
          modules.includes('math1') && modules.includes('math2')) {
        category = 'full_sat'
        template = 'full_sat'
      } else if (modules.length === 2 && 
                 modules.includes('english1') && modules.includes('english2')) {
        category = 'english_only'
        template = 'english_only'
      } else if (modules.length === 2 && 
                 modules.includes('math1') && modules.includes('math2')) {
        category = 'math_only'  
        template = 'math_only'
      } else if (modules.length === 1) {
        category = 'single_module'
        template = 'single_module_' + modules[0]
      } else if (modules.length > 0 && modules.length < 4) {
        category = 'partial'
        template = 'partial_' + modules.sort().join('_')
      }

      templates[category].push({
        id: exam.id,
        title: exam.title,
        modules: moduleCount,
        total_questions: exam.questions.length,
        suggested_template: template,
        time_limits: exam.time_limits
      })

      // Display exam info
      console.log(`${index + 1}. "${exam.title}" (${exam.id.slice(0, 8)}...)`)
      console.log(`   📝 Total questions: ${exam.questions.length}`)
      console.log(`   🧩 Modules: ${Object.entries(moduleCount).map(([mod, count]) => `${mod}(${count})`).join(', ') || 'None'}`)
      console.log(`   🏷️  Suggested template: ${template}`)
      console.log(`   ⏰ Time limits: ${JSON.stringify(exam.time_limits)}`)
      console.log('')
    })

    // Summary statistics
    console.log('📈 SUMMARY ANALYSIS')
    console.log('===================')
    console.log(`Total exams: ${exams.length}`)
    console.log('')

    console.log('📊 By Template Category:')
    Object.entries(templates).forEach(([category, exams]) => {
      if (exams.length > 0) {
        console.log(`  • ${category.replace('_', ' ').toUpperCase()}: ${exams.length} exams`)
      }
    })
    console.log('')

    console.log('🧩 Module Usage Statistics:')
    Object.entries(moduleStats).forEach(([module, count]) => {
      console.log(`  • ${module}: ${count} questions across all exams`)
    })
    console.log('')

    // Migration recommendations
    console.log('🔄 MIGRATION RECOMMENDATIONS')
    console.log('============================')
    
    if (templates.full_sat.length > 0) {
      console.log(`✅ ${templates.full_sat.length} Full SAT exams can use 'full_sat' template`)
    }
    
    if (templates.english_only.length > 0) {
      console.log(`✅ ${templates.english_only.length} English-only exams can use 'english_only' template`)
    }
    
    if (templates.math_only.length > 0) {
      console.log(`✅ ${templates.math_only.length} Math-only exams can use 'math_only' template`)
    }
    
    if (templates.single_module.length > 0) {
      console.log(`✅ ${templates.single_module.length} Single-module exams can use individual templates`)
    }
    
    if (templates.partial.length > 0) {
      console.log(`⚠️  ${templates.partial.length} partial exams need custom templates or completion`)
      templates.partial.forEach(exam => {
        const missing = ['english1', 'english2', 'math1', 'math2'].filter(m => !Object.keys(exam.modules).includes(m))
        console.log(`   • "${exam.title}" missing: ${missing.join(', ')}`)
      })
    }
    
    if (templates.custom.length > 0) {
      console.log(`🔧 ${templates.custom.length} exams need manual review for custom templates`)
    }

    console.log('')
    console.log('📋 NEXT STEPS')
    console.log('=============')
    console.log('1. Run backup script: node scripts/backup-current-exams.js')
    console.log('2. Create template migration plan based on analysis above')
    console.log('3. Implement Phase 1: Database schema for templates')
    console.log('4. Create migration script to convert existing exams to new structure')

  } catch (error) {
    console.error('💥 Analysis failed:', error.message)
    process.exit(1)
  }
}

console.log('🚀 Existing Exams Structure Analysis')
console.log('=====================================')
analyzeExistingExams()