#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../apps/web/.env.local') })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const LETTER_BASE = 'A'.charCodeAt(0)

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '')
const normalizeComparable = (value) => normalizeString(value).toLowerCase()

const letterFromIndex = (index) => String.fromCharCode(LETTER_BASE + index)

function parseChoice(choice, index) {
  const fallbackLetter = letterFromIndex(index)

  if (typeof choice === 'string') {
    const match = choice.match(/^([A-Z])\)\s*(.+)$/)
    if (match) {
      const [, rawLetter, rawText] = match
      return {
        letter: normalizeString(rawLetter).toUpperCase() || fallbackLetter,
        text: normalizeString(rawText),
      }
    }
    return {
      letter: fallbackLetter,
      text: normalizeString(choice),
    }
  }

  if (choice && typeof choice === 'object') {
    if (choice.letter && choice.text) {
      return {
        letter: normalizeString(choice.letter).toUpperCase() || fallbackLetter,
        text: normalizeString(choice.text),
      }
    }

    if (choice.text) {
      return {
        letter: fallbackLetter,
        text: normalizeString(choice.text),
      }
    }
  }

  return {
    letter: fallbackLetter,
    text: normalizeString(String(choice ?? '')),
  }
}

function buildOptionsAndCorrectAnswer(question) {
  const choices = Array.isArray(question.choices) ? question.choices : []
  const options = {}
  const seenLetters = new Set()
  const normalizedCorrectText = normalizeComparable(question.correctAnswer)
  let correctAnswerLetter = null

  choices.forEach((choice, index) => {
    const parsed = parseChoice(choice, index)

    let letter = parsed.letter || letterFromIndex(index)
    let offset = 0
    while (seenLetters.has(letter)) {
      offset += 1
      letter = letterFromIndex(index + offset)
    }
    seenLetters.add(letter)

    options[letter] = parsed.text

    if (
      !correctAnswerLetter &&
      parsed.text &&
      normalizedCorrectText &&
      normalizeComparable(parsed.text) === normalizedCorrectText
    ) {
      correctAnswerLetter = letter
    }
  })

  if (!correctAnswerLetter) {
    const possibleLetter = normalizeString(question.correctAnswer).toUpperCase()
    if (possibleLetter && options[possibleLetter]) {
      correctAnswerLetter = possibleLetter
    }
  }

  if (!correctAnswerLetter) {
    const firstLetter = Object.keys(options)[0]
    if (firstLetter) {
      console.warn(
        `⚠️ Could not match correct answer text for question ${question.questionNumber}. Defaulting to option ${firstLetter}.`
      )
      correctAnswerLetter = firstLetter
    }
  }

  return { options, correctAnswerLetter }
}

async function importTestResults() {
  try {
    console.log('📖 Reading HTML cleaning test results...')

    // Read the test results file
    const testResultsPath = path.join(__dirname, 'html-cleaning-test-results.json')
    const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'))

    console.log(`✅ Found ${testResults.length} questions to import`)

    // Create exam record
    console.log('📝 Creating exam record...')
    const examData = {
      title: 'Test HTML Cleaning Results - English Module 1',
      description: 'Test import of cleaned HTML question data',
      time_limits: {
        english1: 32, // 64 minutes for English module 1
        english2: 32, // Default values for other modules
        math1: 35,
        math2: 55,
      },
      total_questions: testResults.length,
      is_active: true,
      is_mock_exam: false, // This is a test, not a mock exam
      is_custom_assignment: false,
      answer_check_mode: 'exam_end',
    }

    const { data: examRecord, error: examError } = await supabase
      .from('exams')
      .insert([examData])
      .select()
      .single()

    if (examError) {
      console.error('❌ Failed to create exam:', examError)
      return
    }

    console.log('✅ Created exam:', examRecord.title)
    console.log('🆔 Exam ID:', examRecord.id)

    // Prepare questions for batch insert
    console.log('🔄 Preparing questions for import...')

    const questionsToInsert = testResults.map((question) => {
      const { options, correctAnswerLetter } = buildOptionsAndCorrectAnswer(question)

      if (!correctAnswerLetter) {
        throw new Error(
          `Unable to determine correct answer for question ${question.questionNumber}`
        )
      }

      return {
        exam_id: examRecord.id,
        question_number: question.questionNumber,
        module_type: 'english1', // English Module 1
        question_type: 'multiple_choice',
        question_text: question.cleanedHTML,
        options, // Store options with letter keys for front-end compatibility
        correct_answer: correctAnswerLetter,
        correct_answers: [correctAnswerLetter],
        question_image_url: question.imageInfo?.preview?.startsWith('data:image')
          ? question.imageInfo.preview
          : null,
        // Optional fields set to null
        explanation: null,
        difficulty_level: null,
        topic_tags: null,
      }
    })

    console.log('📤 Inserting questions into database...')

    // Insert questions in batches of 50
    const batchSize = 50
    let insertedCount = 0

    for (let i = 0; i < questionsToInsert.length; i += batchSize) {
      const batch = questionsToInsert.slice(i, i + batchSize)

      const { data, error } = await supabase
        .from('questions')
        .insert(batch)
        .select('id')

      if (error) {
        console.error(`❌ Failed to insert batch ${Math.floor(i / batchSize) + 1}:`, error)
        console.error('Error details:', error.details)
        console.error('Problematic batch:', batch.slice(0, 2)) // Show first 2 items
        continue
      }

      insertedCount += data.length
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${data.length} questions`)
    }

    // Update exam with final question count
    const { error: updateError } = await supabase
      .from('exams')
      .update({ total_questions: insertedCount })
      .eq('id', examRecord.id)

    if (updateError) {
      console.warn('⚠️ Failed to update exam question count:', updateError)
    }

    console.log('🎉 Import completed successfully!')
    console.log(`📊 Final stats:`)
    console.log(`   • Exam: "${examRecord.title}"`)
    console.log(`   • Questions imported: ${insertedCount}/${testResults.length}`)
    console.log(`   • Exam ID: ${examRecord.id}`)
  } catch (error) {
    console.error('💥 Import failed:', error)
    process.exit(1)
  }
}

// Run the import
importTestResults()
