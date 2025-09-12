#!/usr/bin/env node

/**
 * Database Migration Script: Markdown to HTML
 * 
 * This script converts all existing markdown content in the database to HTML.
 * It handles:
 * - question_text field
 * - explanation field  
 * - text content within options JSON objects
 * - Custom {{table}} syntax conversion
 * 
 * IMPORTANT: Back up your database before running this script!
 * 
 * Usage: node scripts/migrate-markdown-to-html.js
 */

const { marked } = require('marked')
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: 'apps/web/.env.local' })

// Supabase configuration - using service role key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Please check your environment variables.')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Custom renderer for marked to handle our specific markdown patterns
const renderer = new marked.Renderer()

// Configure marked to handle our custom syntax
marked.setOptions({
  renderer: renderer,
  gfm: true,
  breaks: true,
})

/**
 * Convert custom markdown syntax to HTML
 * Handles patterns like:
 * - {{table}}...{{/table}} -> HTML table
 * - **bold** -> <strong>
 * - *italic* -> <em>
 * - __underline__ -> <u> 
 * - ^^superscript^^ -> <sup>
 * - ~~subscript~~ -> <sub>
 * - --- -> &mdash;
 * - _______ (long blanks) -> styled spans
 * - ::center:: -> centered div
 * - Math expressions remain as-is for now (will be handled by KaTeX on frontend)
 */
function convertMarkdownToHtml(text) {
  if (!text || typeof text !== 'string') return text

  let processedText = text

  // Handle tables first - convert {{table}}...{{/table}} to HTML
  processedText = processedText.replace(
    /{{table}}([\s\S]*?){{\/table}}/g,
    (match, tableContent) => {
      const lines = tableContent.trim().split('\n').filter(line => line.trim())
      if (lines.length < 3) return match

      const headers = lines[0].split('|').map(h => h.trim())
      const rows = lines.slice(2).map(line => 
        line.split('|').map(cell => cell.trim())
      )

      let tableHtml = '<table class="border-collapse border border-gray-300 w-full my-4">\n'
      tableHtml += '  <thead>\n    <tr class="bg-gray-50">\n'
      headers.forEach(header => {
        tableHtml += `      <th class="border border-gray-300 px-4 py-2 text-left font-semibold">${header}</th>\n`
      })
      tableHtml += '    </tr>\n  </thead>\n  <tbody>\n'
      
      rows.forEach((row, i) => {
        const bgClass = i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
        tableHtml += `    <tr class="${bgClass}">\n`
        row.forEach(cell => {
          tableHtml += `      <td class="border border-gray-300 px-4 py-2">${cell}</td>\n`
        })
        tableHtml += '    </tr>\n'
      })
      tableHtml += '  </tbody>\n</table>'
      return tableHtml
    }
  )

  // Handle positioned images
  processedText = processedText.replace(
    /{{img-(left|center|right)}}!\[(.*?)\]\((.*?)\){{\/img-(left|center|right)}}/g,
    (match, position, alt, url) => {
      const alignClass = position === 'left' ? 'text-left' : 
                        position === 'right' ? 'text-right' : 'text-center'
      return `<div class="my-4 ${alignClass}"><img src="${url}" alt="${alt}" class="max-w-full h-auto border border-gray-200 rounded inline-block" /></div>`
    }
  )

  // Handle long blanks (5+ underscores)
  processedText = processedText.replace(/_{5,}/g, (match) => {
    const length = match.length
    return `<span style="display: inline-block; width: ${Math.max(length * 0.8, 3)}em; min-width: 3em; border-bottom: 1px solid #374151; height: 1.2em; margin-bottom: 1px;">&nbsp;</span>`
  })

  // Handle center alignment
  processedText = processedText.replace(/::(.*?)::/g, '<div class="text-center my-2">$1</div>')

  // Handle superscript and subscript before processing underlines
  processedText = processedText.replace(/\^\^(.*?)\^\^/g, '<sup>$1</sup>')
  processedText = processedText.replace(/~~(.*?)~~/g, '<sub>$1</sub>')

  // Handle underlines (but not the underscore-based italics)
  processedText = processedText.replace(/__([^_]*?)__/g, '<u>$1</u>')

  // Handle em dashes
  processedText = processedText.replace(/---/g, '&mdash;')
  processedText = processedText.replace(/--/g, '&ndash;')

  // Handle line breaks
  processedText = processedText.replace(/\\n/g, '<br>')

  // Use marked for standard markdown (bold, italic, lists, etc.)
  const htmlContent = marked(processedText)

  return htmlContent
}

/**
 * Process options JSON - convert text content within each option
 */
function convertOptionsToHtml(options) {
  if (!options || typeof options !== 'object') return options

  const convertedOptions = {}
  
  for (const [key, value] of Object.entries(options)) {
    try {
      // Parse the option value if it's a JSON string
      let optionData
      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        optionData = JSON.parse(value)
      } else if (typeof value === 'object') {
        optionData = value
      } else {
        optionData = { text: String(value) }
      }

      // Convert text content to HTML
      if (optionData.text) {
        optionData.text = convertMarkdownToHtml(optionData.text)
      }

      // Keep other properties (imageUrl, table_data, etc.) as-is
      convertedOptions[key] = JSON.stringify(optionData)
    } catch (error) {
      console.warn(`⚠️  Failed to process option ${key}:`, error.message)
      convertedOptions[key] = value // Keep original if parsing fails
    }
  }

  return convertedOptions
}

/**
 * Automatic backup function
 */
async function createBackup() {
  console.log('📦 Creating automatic backup before migration...')
  
  try {
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch questions for backup: ${error.message}`)
    }

    // Create backups directory if it doesn't exist
    if (!fs.existsSync('scripts/backups')) {
      fs.mkdirSync('scripts/backups', { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `scripts/backups/pre-migration-backup-${timestamp}.json`
    
    const backupData = {
      backup_timestamp: new Date().toISOString(),
      backup_reason: 'Pre-migration backup (markdown to HTML)',
      total_questions: questions.length,
      questions: questions
    }

    fs.writeFileSync(filename, JSON.stringify(backupData, null, 2))
    console.log(`✅ Backup created: ${filename}`)
    console.log(`💾 Backed up ${questions.length} questions`)
    
    return filename
  } catch (error) {
    console.error('❌ Failed to create backup:', error.message)
    throw error
  }
}

/**
 * Main migration function
 */
async function migrateMarkdownToHtml() {
  console.log('🚀 Starting markdown to HTML migration...')
  
  try {
    // Automatic backup
    const backupFile = await createBackup()
    console.log(`📁 Backup completed: ${backupFile}`)
    console.log('ℹ️  If migration fails, you can restore from this backup\n')
    // Get all questions from the database
    console.log('📊 Fetching all questions...')
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')

    if (error) {
      throw new Error(`Failed to fetch questions: ${error.message}`)
    }

    console.log(`📝 Found ${questions.length} questions to process`)

    let successCount = 0
    let errorCount = 0

    // Process each question
    for (const question of questions) {
      try {
        console.log(`Processing question ${question.id}...`)

        const updates = {}
        let hasUpdates = false

        // Convert question_text
        if (question.question_text) {
          const htmlQuestionText = convertMarkdownToHtml(question.question_text)
          if (htmlQuestionText !== question.question_text) {
            updates.question_text = htmlQuestionText
            hasUpdates = true
          }
        }

        // Convert explanation
        if (question.explanation) {
          const htmlExplanation = convertMarkdownToHtml(question.explanation)
          if (htmlExplanation !== question.explanation) {
            updates.explanation = htmlExplanation
            hasUpdates = true
          }
        }

        // Convert options
        if (question.options) {
          const htmlOptions = convertOptionsToHtml(question.options)
          if (JSON.stringify(htmlOptions) !== JSON.stringify(question.options)) {
            updates.options = htmlOptions
            hasUpdates = true
          }
        }

        // Update the question if there are changes
        if (hasUpdates) {
          const { error: updateError } = await supabase
            .from('questions')
            .update(updates)
            .eq('id', question.id)

          if (updateError) {
            throw new Error(`Failed to update question ${question.id}: ${updateError.message}`)
          }

          console.log(`✅ Updated question ${question.id}`)
        } else {
          console.log(`ℹ️  No changes needed for question ${question.id}`)
        }

        successCount++
      } catch (error) {
        console.error(`❌ Error processing question ${question.id}:`, error.message)
        errorCount++
      }
    }

    console.log('\n🎉 Migration completed!')
    console.log(`✅ Successfully processed: ${successCount} questions`)
    console.log(`❌ Errors: ${errorCount} questions`)

    if (errorCount > 0) {
      console.log('\n⚠️  Some questions had errors. Please review the logs above.')
      process.exit(1)
    }

  } catch (error) {
    console.error('💥 Migration failed:', error.message)
    process.exit(1)
  }
}

// Confirmation check
function askForConfirmation() {
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  rl.question('\n⚠️  This will permanently modify your database content.\nHave you backed up your database? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      rl.close()
      migrateMarkdownToHtml()
    } else {
      console.log('❌ Migration cancelled. Please backup your database first.')
      rl.close()
      process.exit(1)
    }
  })
}

// Show migration preview for first few questions
async function showPreview() {
  console.log('🔍 Migration Preview - showing first 3 questions:')
  
  try {
    const { data: questions, error } = await supabase
      .from('questions')
      .select('id, question_text, explanation, options')
      .limit(3)

    if (error) throw error

    questions.forEach((question, index) => {
      console.log(`\n--- Question ${index + 1} (ID: ${question.id}) ---`)
      
      if (question.question_text) {
        console.log('BEFORE (question_text):', question.question_text.substring(0, 100) + '...')
        console.log('AFTER (question_text):', convertMarkdownToHtml(question.question_text).substring(0, 100) + '...')
      }
      
      if (question.explanation) {
        console.log('BEFORE (explanation):', question.explanation.substring(0, 50) + '...')  
        console.log('AFTER (explanation):', convertMarkdownToHtml(question.explanation).substring(0, 50) + '...')
      }

      if (question.options) {
        console.log('OPTIONS will be processed:', Object.keys(question.options).length, 'options')
      }
    })

    askForConfirmation()
  } catch (error) {
    console.error('❌ Failed to fetch preview:', error.message)
    process.exit(1)
  }
}

// Run preview first, then ask for confirmation
showPreview()