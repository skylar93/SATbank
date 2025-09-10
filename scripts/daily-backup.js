#!/usr/bin/env node

/**
 * Simple daily backup script for GitHub Actions
 * Backs up all important tables to JSON files
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function backupTable(tableName, backupDir) {
  console.log(`📋 Backing up ${tableName}...`)
  
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10000) // 안전을 위한 제한

  if (error) {
    console.error(`❌ Error backing up ${tableName}:`, error)
    return false
  }

  const backupData = {
    table: tableName,
    backup_date: new Date().toISOString(),
    total_records: data.length,
    records: data
  }

  const filename = `${tableName}.json`
  const filepath = path.join(backupDir, filename)
  
  fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2))
  console.log(`✅ ${tableName}: ${data.length} records backed up`)
  
  return true
}

async function main() {
  console.log('🔄 Starting daily backup...')
  
  const today = new Date().toISOString().split('T')[0]
  const backupDir = path.join(__dirname, 'backups', today)
  
  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  // Tables to backup
  const tables = [
    'questions',
    'exams', 
    'test_attempts',
    'user_answers',
    'user_profiles'
  ]

  let successful = 0
  let total = tables.length

  for (const table of tables) {
    const success = await backupTable(table, backupDir)
    if (success) successful++
  }

  // Create summary
  const summary = {
    backup_date: new Date().toISOString(),
    successful_tables: successful,
    total_tables: total,
    backup_location: backupDir,
    tables: tables
  }

  fs.writeFileSync(
    path.join(backupDir, '_backup_summary.json'),
    JSON.stringify(summary, null, 2)
  )

  // Clean old backups (keep last 30 days)
  const backupsRoot = path.join(__dirname, 'backups')
  if (fs.existsSync(backupsRoot)) {
    const folders = fs.readdirSync(backupsRoot)
      .filter(folder => folder.match(/^\d{4}-\d{2}-\d{2}$/))
      .sort()
      .reverse()

    if (folders.length > 30) {
      const toDelete = folders.slice(30)
      toDelete.forEach(folder => {
        const folderPath = path.join(backupsRoot, folder)
        fs.rmSync(folderPath, { recursive: true })
        console.log(`🗑️  Deleted old backup: ${folder}`)
      })
    }
  }

  console.log(`✅ Daily backup completed: ${successful}/${total} tables backed up`)
  
  if (successful < total) {
    process.exit(1) // Fail the GitHub Action if some backups failed
  }
}

main().catch(console.error)