#!/usr/bin/env node

/**
 * Simple Questions Backup Script for Supabase Free Tier
 * 
 * This script exports all questions data to JSON format
 * for easy backup and restore if needed.
 * 
 * Usage: node scripts/backup-questions.js
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

async function backupQuestions() {
  console.log('📦 Starting questions backup...')
  
  try {
    // Get all questions
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch questions: ${error.message}`)
    }

    console.log(`📊 Found ${questions.length} questions to backup`)

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `backup-questions-${timestamp}.json`
    const filepath = `scripts/backups/${filename}`

    // Create backups directory if it doesn't exist
    if (!fs.existsSync('scripts/backups')) {
      fs.mkdirSync('scripts/backups', { recursive: true })
    }

    // Write backup file
    const backupData = {
      backup_timestamp: new Date().toISOString(),
      total_questions: questions.length,
      questions: questions
    }

    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2))

    console.log('✅ Backup completed successfully!')
    console.log(`📁 Backup saved to: ${filepath}`)
    console.log(`💾 File size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`)
    
    // Show sample of what was backed up
    console.log('\n📝 Sample of backed up data:')
    console.log(`- Question ID: ${questions[0].id}`)
    console.log(`- Question text: ${questions[0].question_text.substring(0, 50)}...`)
    console.log(`- Question type: ${questions[0].question_type}`)
    console.log(`- Module: ${questions[0].module_type}`)

  } catch (error) {
    console.error('💥 Backup failed:', error.message)
    process.exit(1)
  }
}

// Also create a restore script reference
const restoreInstructions = `
/**
 * To restore from this backup:
 * 
 * 1. Load the backup file
 * 2. Truncate the questions table (be careful!)
 * 3. Re-insert all questions
 * 
 * Example restore code:
 * 
 * const backupData = JSON.parse(fs.readFileSync('backup-file.json'))
 * await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
 * await supabase.from('questions').insert(backupData.questions)
 */
`

console.log('🚀 Questions Backup Tool')
console.log('=======================')
backupQuestions()