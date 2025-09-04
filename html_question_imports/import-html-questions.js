#!/usr/bin/env node

/**
 * HTML Questions Import Script
 * 
 * This script imports HTML question data from the extracted JSON file
 * and converts it to match the SATbank database schema.
 * 
 * Usage: node html_question_imports/import-html-questions.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: 'apps/web/.env.local' })

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Transform choices array to options object
 * @param {string[]} choices - ["A) Looked at", "B) Had questions about", ...]
 * @returns {object} - {"A": "Looked at", "B": "Had questions about", ...}
 */
function transformChoicesToOptions(choices) {
  const options = {}
  
  choices.forEach(choice => {
    // Handle different choice formats
    let match = choice.match(/^([A-D])\)\s*(.+)$/)
    if (match) {
      const [, key, text] = match
      options[key] = text.trim()
    } else {
      console.warn(`⚠️  Unexpected choice format: ${choice}`)
      // Fallback: try to extract first letter
      const key = choice.charAt(0)
      const text = choice.substring(2).trim()
      if (['A', 'B', 'C', 'D'].includes(key)) {
        options[key] = text
      }
    }
  })
  
  return options
}

/**
 * Find correct answer key by matching text
 * @param {string[]} choices - Choice array
 * @param {string} correctAnswer - Correct answer text
 * @returns {string[]} - ["A"] format for JSONB
 */
function findCorrectAnswerKey(choices, correctAnswer) {
  for (const choice of choices) {
    const match = choice.match(/^([A-D])\)\s*(.+)$/)
    if (match) {
      const [, key, text] = match
      if (text.trim() === correctAnswer.trim()) {
        return [key]
      }
    }
  }
  
  console.warn(`⚠️  Could not find matching key for answer: "${correctAnswer}"`)
  console.warn(`Available choices:`, choices)
  return ['A'] // Fallback
}

/**
 * Determine module type from testId
 * @param {string} testId - Test identifier
 * @returns {string} - Module type enum value
 */
function determineModuleType(testId) {
  // For now, all tests are English Module 1
  // In the future, add logic to detect module type from testId
  if (testId.includes('module_1')) {
    return 'english1'
  } else if (testId.includes('module_2')) {
    return 'english2'
  }
  
  // Default to english1
  return 'english1'
}

/**
 * Extract clean HTML content from questionHTML, preserving formatting
 * @param {string} questionHTML - Raw HTML content from source
 * @returns {string} - Cleaned HTML content with formatting preserved
 */
function extractCleanHTML(questionHTML) {
  if (!questionHTML) return ''
  
  try {
    // Extract content from article-main div
    // Pattern: <div class="article-main ...><div ...>CONTENT</div></div>
    const articleMainMatch = questionHTML.match(/<div class="article-main[^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/)
    
    if (articleMainMatch) {
      let content = articleMainMatch[1]
      
      // Remove style blocks but keep inline styles
      content = content.replace(/<style[\s\S]*?<\/style>/gi, '')
      
      // Clean up excessive whitespace while preserving structure
      content = content.replace(/\n\s*\n/g, '\n')
      content = content.replace(/\s+/g, ' ')
      content = content.trim()
      
      return content
    }
    
    console.warn('⚠️  Could not extract content from article-main, falling back to basic cleaning')
    return basicHtmlClean(questionHTML)
    
  } catch (error) {
    console.warn('⚠️  HTML extraction failed:', error.message)
    return basicHtmlClean(questionHTML)
  }
}

/**
 * Basic HTML cleaning as fallback
 * @param {string} html - Raw HTML
 * @returns {string} - Basic cleaned HTML
 */
function basicHtmlClean(html) {
  if (!html) return ''
  
  // Remove script, style, and UI elements
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  cleaned = cleaned.replace(/<div class="question-cell[\s\S]*$/, '') // Remove everything after question content
  
  // Remove wrapper divs but keep content formatting
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*(?:article-cell|article-main|question-widget|review-container|question-tools)[^"]*"[^>]*>/gi, '')
  cleaned = cleaned.replace(/<\/div>/gi, '')
  cleaned = cleaned.replace(/<img[^>]*>/gi, '') // Remove images
  
  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  return cleaned
}

/**
 * Clean HTML content and extract plain text
 * @param {string} html - Raw HTML content
 * @returns {string} - Cleaned text
 */
function cleanHtmlContent(html) {
  if (!html) return ''
  
  // Remove script and style elements
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  
  // Remove HTML tags but preserve basic formatting
  cleaned = cleaned.replace(/<[^>]*>/g, ' ')
  
  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  return cleaned
}

/**
 * Transform source question to database format
 * @param {object} sourceQuestion - Original question object
 * @param {string} examId - Target exam ID
 * @returns {object} - Transformed question object
 */
function transformQuestion(sourceQuestion, examId) {
  const options = transformChoicesToOptions(sourceQuestion.choices)
  const correctAnswer = findCorrectAnswerKey(sourceQuestion.choices, sourceQuestion.correctAnswer)
  
  // Extract clean HTML content while preserving formatting
  const cleanHTML = extractCleanHTML(sourceQuestion.questionHTML)
  
  return {
    exam_id: examId,
    question_number: sourceQuestion.questionNumber,
    module_type: 'english1', // Hardcoded for now
    question_type: 'multiple_choice',
    difficulty_level: 'medium',
    question_text: sourceQuestion.questionText, // Plain text version
    question_html: cleanHTML, // HTML version with formatting preserved
    question_image_url: null, // Will handle images separately
    options: options,
    correct_answer: correctAnswer,
    explanation: sourceQuestion.explanation,
    points: 1,
    topic_tags: null
  }
}

/**
 * Create exam record from test data
 * @param {object} testData - Test information
 * @returns {object} - Exam object
 */
function createExamFromTest(testData) {
  const moduleType = determineModuleType(testData.testId)
  const moduleName = moduleType === 'english1' ? 'English 1' : 
                    moduleType === 'english2' ? 'English 2' :
                    moduleType === 'math1' ? 'Math 1' : 'Math 2'
  
  return {
    title: `SAT August 2023 - Module 1 (${moduleName})`,
    description: `Imported from ${testData.testId} on ${new Date().toISOString()}`,
    total_questions: testData.questionCount,
    time_limits: {[moduleType]: 64}, // 64 minutes for English modules
    is_mock_exam: true,
    is_active: true,
    is_custom_assignment: false
  }
}

/**
 * Validate transformed question data
 * @param {object} question - Transformed question
 * @returns {boolean} - Whether question is valid
 */
function validateQuestion(question) {
  const errors = []
  
  // Check required fields
  if (!question.question_text) errors.push('Missing question_text')
  if (!question.question_number) errors.push('Missing question_number')
  if (!question.options || Object.keys(question.options).length === 0) {
    errors.push('Missing or empty options')
  }
  if (!question.correct_answer || question.correct_answer.length === 0) {
    errors.push('Missing correct_answer')
  }
  
  // Validate options format
  const optionKeys = Object.keys(question.options || {})
  const validKeys = ['A', 'B', 'C', 'D']
  if (!optionKeys.every(key => validKeys.includes(key))) {
    errors.push(`Invalid option keys: ${optionKeys.join(', ')}`)
  }
  
  // Validate correct answer exists in options
  if (question.correct_answer && question.options) {
    const correctKey = question.correct_answer[0]
    if (!question.options[correctKey]) {
      errors.push(`Correct answer key '${correctKey}' not found in options`)
    }
  }
  
  if (errors.length > 0) {
    console.error(`❌ Question ${question.question_number} validation failed:`)
    errors.forEach(error => console.error(`   - ${error}`))
    return false
  }
  
  return true
}

/**
 * Test data transformation without database operations
 * @param {string} jsonFilePath - Path to JSON file
 */
async function testTransformation(jsonFilePath) {
  console.log('🧪 Testing data transformation...\n')
  
  // Read JSON file
  const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'))
  
  // Find the target test
  const testData = jsonData.tests.find(test => test.testId === 'module_1_august_2023')
  if (!testData) {
    console.error('❌ Test "module_1_august_2023" not found')
    return false
  }
  
  console.log(`📋 Test Info:`)
  console.log(`   - ID: ${testData.testId}`)
  console.log(`   - Name: ${testData.testName}`)
  console.log(`   - Questions: ${testData.questionCount}`)
  console.log(`   - Collected: ${testData.collectedAt}`)
  
  // Create exam object
  const examData = createExamFromTest(testData)
  console.log(`\n📚 Exam Data:`)
  console.log(`   - Title: ${examData.title}`)
  console.log(`   - Total Questions: ${examData.total_questions}`)
  console.log(`   - Time Limits:`, examData.time_limits)
  
  // Transform first few questions as test
  console.log(`\n🔄 Transforming questions...`)
  let successCount = 0
  let errorCount = 0
  
  const testQuestions = testData.questions.slice(0, 3) // Test first 3 questions
  
  for (const sourceQuestion of testQuestions) {
    console.log(`\n--- Question ${sourceQuestion.questionNumber} ---`)
    
    try {
      const transformed = transformQuestion(sourceQuestion, 'test-exam-id')
      
      console.log(`📝 Plain Text:`)
      console.log(`"${transformed.question_text.substring(0, 200)}..."`)
      
      console.log(`\n🎨 HTML Content:`)
      console.log(`"${transformed.question_html?.substring(0, 300) || 'NULL'}..."`)
      
      console.log(`\n📋 Choices:`)
      console.log(`Original:`, sourceQuestion.choices)
      console.log(`Transformed:`, transformed.options)
      
      console.log(`\n✓ Answer:`)
      console.log(`Original: "${sourceQuestion.correctAnswer}"`)
      console.log(`Transformed:`, transformed.correct_answer)
      
      if (validateQuestion(transformed)) {
        console.log(`✅ Question ${sourceQuestion.questionNumber} transformation successful`)
        successCount++
      } else {
        errorCount++
      }
      
    } catch (error) {
      console.error(`❌ Question ${sourceQuestion.questionNumber} transformation failed:`, error.message)
      errorCount++
    }
  }
  
  console.log(`\n📊 Transformation Test Results:`)
  console.log(`   - Success: ${successCount}`)
  console.log(`   - Errors: ${errorCount}`)
  
  return errorCount === 0
}

/**
 * Full import process
 * @param {string} jsonFilePath - Path to JSON file
 * @param {boolean} dryRun - Whether to perform actual database operations
 */
async function importQuestions(jsonFilePath, dryRun = true) {
  console.log(`🚀 Starting import process (${dryRun ? 'DRY RUN' : 'LIVE'})...\n`)
  
  try {
    // Read and validate JSON
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'))
    const testData = jsonData.tests.find(test => test.testId === 'module_1_august_2023')
    
    if (!testData) {
      throw new Error('Test "module_1_august_2023" not found')
    }
    
    // Create exam
    const examData = createExamFromTest(testData)
    let examId = 'test-exam-id'
    
    if (!dryRun) {
      console.log('📚 Creating exam...')
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .insert(examData)
        .select('id')
        .single()
      
      if (examError) throw examError
      examId = exam.id
      console.log(`✅ Exam created with ID: ${examId}`)
    } else {
      console.log('📚 [DRY RUN] Would create exam:', examData.title)
    }
    
    // Transform and validate all questions
    console.log('🔄 Processing questions...')
    const questions = []
    let validCount = 0
    
    for (const sourceQuestion of testData.questions) {
      try {
        const transformed = transformQuestion(sourceQuestion, examId)
        
        if (validateQuestion(transformed)) {
          questions.push(transformed)
          validCount++
        }
      } catch (error) {
        console.error(`❌ Failed to transform question ${sourceQuestion.questionNumber}:`, error.message)
      }
    }
    
    console.log(`✅ Transformed ${validCount}/${testData.questions.length} questions`)
    
    // Insert questions
    if (!dryRun && questions.length > 0) {
      console.log('💾 Inserting questions into database...')
      const { data, error } = await supabase
        .from('questions')
        .insert(questions)
      
      if (error) throw error
      console.log(`✅ Inserted ${questions.length} questions`)
    } else if (dryRun) {
      console.log(`💾 [DRY RUN] Would insert ${questions.length} questions`)
    }
    
    console.log(`\n🎉 Import completed successfully!`)
    return true
    
  } catch (error) {
    console.error(`💥 Import failed:`, error.message)
    return false
  }
}

/**
 * Main execution
 */
async function main() {
  const jsonFilePath = path.join(__dirname, 'bluebook-sat-problems-2025-09-01.json')
  
  // Check if file exists
  if (!fs.existsSync(jsonFilePath)) {
    console.error(`❌ JSON file not found: ${jsonFilePath}`)
    process.exit(1)
  }
  
  console.log('📁 Found JSON file:', jsonFilePath)
  console.log('🔧 Supabase URL:', supabaseUrl)
  console.log('🔑 Service key:', supabaseServiceKey ? 'SET' : 'MISSING')
  console.log()
  
  // Step 1: Test transformation
  console.log('='.repeat(60))
  console.log('STEP 1: TESTING DATA TRANSFORMATION')
  console.log('='.repeat(60))
  
  const transformSuccess = await testTransformation(jsonFilePath)
  
  if (!transformSuccess) {
    console.error('❌ Transformation test failed. Fix errors before proceeding.')
    process.exit(1)
  }
  
  // Step 2: Dry run
  console.log('\n' + '='.repeat(60))
  console.log('STEP 2: DRY RUN IMPORT')
  console.log('='.repeat(60))
  
  const dryRunSuccess = await importQuestions(jsonFilePath, true)
  
  if (!dryRunSuccess) {
    console.error('❌ Dry run failed. Fix errors before proceeding.')
    process.exit(1)
  }
  
  // Prompt for live run
  console.log('\n' + '='.repeat(60))
  console.log('READY FOR LIVE IMPORT')
  console.log('='.repeat(60))
  console.log('✅ All tests passed!')
  console.log('🚨 To perform the actual import, run:')
  console.log('    node html_question_imports/import-html-questions.js --live')
  
  // Check for live flag
  if (process.argv.includes('--live')) {
    console.log('\n🚨 PERFORMING LIVE IMPORT...')
    await importQuestions(jsonFilePath, false)
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })
}