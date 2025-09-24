const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables from web app
require('dotenv').config({ path: './apps/web/.env.local' })

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const tables = [
  'user_profiles',
  'exams',
  'questions',
  'test_attempts',
  'user_answers',
  'exam_assignments',
  'scoring_curves',
  'regrade_history',
  'mistake_bank',
  'exam_questions',
  'vocab_sets',
  'vocab_entries',
  'quiz_sessions',
  'exam_templates'
]

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = `./backups/backup-${timestamp}`

  // Create backup directory
  if (!fs.existsSync('./backups')) {
    fs.mkdirSync('./backups')
  }
  fs.mkdirSync(backupDir)

  console.log(`Creating backup in ${backupDir}`)

  for (const table of tables) {
    try {
      console.log(`Backing up ${table}...`)

      // Get all data from table
      const { data, error } = await supabase
        .from(table)
        .select('*')

      if (error) {
        console.error(`Error backing up ${table}:`, error)
        continue
      }

      // Convert to CSV
      if (data && data.length > 0) {
        const csv = convertToCSV(data)
        fs.writeFileSync(path.join(backupDir, `${table}.csv`), csv)
        console.log(`✓ ${table}: ${data.length} records`)
      } else {
        console.log(`✓ ${table}: 0 records`)
      }

    } catch (err) {
      console.error(`Failed to backup ${table}:`, err)
    }
  }

  // Create metadata file
  const metadata = {
    backup_date: new Date().toISOString(),
    tables_backed_up: tables,
    database_url: supabaseUrl
  }

  fs.writeFileSync(
    path.join(backupDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  )

  console.log(`\n✅ Backup completed: ${backupDir}`)
}

function convertToCSV(data) {
  if (!data || data.length === 0) return ''

  const headers = Object.keys(data[0])
  const csvRows = []

  // Add headers
  csvRows.push(headers.map(h => `"${h}"`).join(','))

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header]
      if (val === null || val === undefined) return '""'
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`
      return `"${String(val).replace(/"/g, '""')}"`
    })
    csvRows.push(values.join(','))
  }

  return csvRows.join('\n')
}

// Run backup
if (require.main === module) {
  backupDatabase().catch(console.error)
}

module.exports = { backupDatabase }