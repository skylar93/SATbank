#!/usr/bin/env node

/**
 * Restore Questions from Backup Script
 * 
 * This script restores questions from a JSON backup file
 * 
 * Usage: node scripts/restore-from-backup.js <backup-file-path>
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: '../.env.local' })

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function restoreFromBackup(backupFilePath) {
  console.log('🔄 Starting restore from backup...')
  
  try {
    // Check if backup file exists
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file not found: ${backupFilePath}`)
    }

    // Load backup data
    console.log(`📂 Loading backup from: ${backupFilePath}`)
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'))
    
    console.log(`📊 Backup contains ${backupData.total_questions} questions`)
    console.log(`📅 Backup created: ${backupData.backup_timestamp}`)
    
    // Ask for confirmation
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    rl.question(`\n⚠️  This will REPLACE all current questions with backup data.\nAre you sure you want to continue? (yes/no): `, async (answer) => {
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('❌ Restore cancelled.')
        rl.close()
        process.exit(0)
      }

      rl.close()

      try {
        console.log('🗑️  Deleting current questions...')
        const { error: deleteError } = await supabase
          .from('questions')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

        if (deleteError) {
          throw new Error(`Failed to delete current questions: ${deleteError.message}`)
        }

        console.log('📥 Inserting backup questions...')
        
        // Insert in batches to avoid timeout
        const batchSize = 100
        let insertedCount = 0
        
        for (let i = 0; i < backupData.questions.length; i += batchSize) {
          const batch = backupData.questions.slice(i, i + batchSize)
          
          const { error: insertError } = await supabase
            .from('questions')
            .insert(batch)

          if (insertError) {
            throw new Error(`Failed to insert batch at index ${i}: ${insertError.message}`)
          }
          
          insertedCount += batch.length
          console.log(`✅ Inserted ${insertedCount}/${backupData.total_questions} questions`)
        }

        console.log('\n🎉 Restore completed successfully!')
        console.log(`✅ Restored ${insertedCount} questions from backup`)
        
      } catch (error) {
        console.error('💥 Restore failed:', error.message)
        console.error('⚠️  Your database may be in an inconsistent state!')
        process.exit(1)
      }
    })
    
  } catch (error) {
    console.error('💥 Failed to load backup:', error.message)
    process.exit(1)
  }
}

// Get backup file path from command line argument
const backupFilePath = process.argv[2]

if (!backupFilePath) {
  console.error('❌ Please provide backup file path')
  console.error('Usage: node scripts/restore-from-backup.js <backup-file-path>')
  console.error('Example: node scripts/restore-from-backup.js scripts/backups/pre-migration-backup-2024-08-30T10-30-00.json')
  process.exit(1)
}

console.log('🔄 Questions Restore Tool')
console.log('========================')
restoreFromBackup(backupFilePath)