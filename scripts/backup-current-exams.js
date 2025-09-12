#!/usr/bin/env node

/**
 * Current Exams Backup Script
 * 
 * This script exports all exams and their associated questions
 * to prepare for the new template-based architecture.
 * 
 * Usage: node scripts/backup-current-exams.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: 'apps/web/.env.local' })

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Please check your environment variables.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function backupCurrentExams() {
  console.log('📦 Starting current exams backup...')
  
  try {
    // Get all exams with their questions
    const { data: exams, error: examsError } = await supabase
      .from('exams')
      .select(`
        *,
        questions (
          id,
          question_number,
          module_type,
          question_type,
          question_text,
          options,
          correct_answer,
          explanation,
          difficulty_level,
          topic_tags,
          question_image_url
        )
      `)
      .order('created_at', { ascending: true })

    if (examsError) {
      throw new Error(`Failed to fetch exams: ${examsError.message}`)
    }

    console.log(`📊 Found ${exams.length} exams to backup`)

    // Analyze current exam structure
    const analysis = {
      total_exams: exams.length,
      exams_by_type: {},
      module_distribution: {},
      questions_per_exam: {},
      time_limits_analysis: {}
    }

    exams.forEach(exam => {
      // Count questions by module for each exam
      const moduleCount = {}
      exam.questions.forEach(q => {
        moduleCount[q.module_type] = (moduleCount[q.module_type] || 0) + 1
      })

      analysis.questions_per_exam[exam.id] = {
        title: exam.title,
        total_questions: exam.questions.length,
        by_module: moduleCount,
        time_limits: exam.time_limits
      }

      // Overall module distribution
      Object.keys(moduleCount).forEach(module => {
        analysis.module_distribution[module] = (analysis.module_distribution[module] || 0) + moduleCount[module]
      })

      // Time limits analysis
      if (exam.time_limits) {
        Object.keys(exam.time_limits).forEach(module => {
          if (!analysis.time_limits_analysis[module]) {
            analysis.time_limits_analysis[module] = []
          }
          analysis.time_limits_analysis[module].push(exam.time_limits[module])
        })
      }
    })

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `backup-current-exams-${timestamp}.json`
    const analysisFilename = `exam-structure-analysis-${timestamp}.json`
    const filepath = `scripts/backups/${filename}`
    const analysisPath = `scripts/backups/${analysisFilename}`

    // Create backups directory if it doesn't exist
    if (!fs.existsSync('scripts/backups')) {
      fs.mkdirSync('scripts/backups', { recursive: true })
    }

    // Write backup file
    const backupData = {
      backup_timestamp: new Date().toISOString(),
      total_exams: exams.length,
      purpose: "Pre-template-architecture backup",
      exams: exams
    }

    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2))
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2))

    console.log('✅ Backup completed successfully!')
    console.log(`📁 Backup saved to: ${filepath}`)
    console.log(`📊 Analysis saved to: ${analysisPath}`)
    console.log(`💾 Backup size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`)
    
    // Show analysis summary
    console.log('\n📈 Current Exam Structure Analysis:')
    console.log(`- Total exams: ${analysis.total_exams}`)
    console.log(`- Total questions across all exams: ${Object.values(analysis.module_distribution).reduce((a, b) => a + b, 0)}`)
    console.log(`- Module distribution:`)
    Object.entries(analysis.module_distribution).forEach(([module, count]) => {
      console.log(`  • ${module}: ${count} questions`)
    })

    console.log('\n💡 Template Migration Suggestions:')
    exams.forEach(exam => {
      const modules = Object.keys(analysis.questions_per_exam[exam.id].by_module)
      let suggestedTemplate = 'custom'
      
      if (modules.length === 4 && modules.includes('english1') && modules.includes('english2') && modules.includes('math1') && modules.includes('math2')) {
        suggestedTemplate = 'full_sat'
      } else if (modules.length === 2 && modules.includes('english1') && modules.includes('english2')) {
        suggestedTemplate = 'english_only'
      } else if (modules.length === 2 && modules.includes('math1') && modules.includes('math2')) {
        suggestedTemplate = 'math_only'
      } else if (modules.length === 1) {
        suggestedTemplate = 'single_module'
      }

      console.log(`  • "${exam.title}" → ${suggestedTemplate} template`)
    })

  } catch (error) {
    console.error('💥 Backup failed:', error.message)
    process.exit(1)
  }
}

console.log('🚀 Current Exams Backup Tool')
console.log('============================')
backupCurrentExams()