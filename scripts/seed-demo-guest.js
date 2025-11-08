#!/usr/bin/env node
/**
 * Seeds curated dashboard/demo data for the guest preview account.
 *
 * Usage:
 *   node scripts/seed-demo-guest.js
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and optionally
 * NEXT_PUBLIC_GUEST_EMAIL to be defined (loaded automatically from apps/web/.env.local).
 */

const path = require('path')
const { randomUUID } = require('crypto')
const { config } = require('dotenv')
const { createClient } = require('@supabase/supabase-js')

config({ path: path.join(__dirname, '..', 'apps', 'web', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GUEST_EMAIL =
  process.env.NEXT_PUBLIC_GUEST_EMAIL || 'guest@satbank-demo.com'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials. Check your environment vars.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const PRIMARY_EXAM_ID = '4796f645-9975-4872-b466-e3b5248dcc6c' // Full mock exam with all modules
const MATH_FOCUS_EXAM_ID = '665c2c26-5103-4fc9-9506-74e7c7935646'
const ENGLISH_PAIR_EXAM_ID = '0d76fd95-3783-4e9f-9c06-51bce5bf3907'
const ENGLISH_TWO_EXAM_ID = '00a08432-a337-4ca7-b2dc-154333c0d605'
const ADMIN_ASSIGNER_ID = '5b4c2783-8afa-420e-b3a5-f761b472a503'
const DAY_MS = 24 * 60 * 60 * 1000

async function main() {
  console.log('🌱 Seeding guest dashboard data...')
  const guestId = await resolveGuestId(GUEST_EMAIL)
  if (!guestId) {
    throw new Error(`Guest user with email ${GUEST_EMAIL} not found`)
  }

  await updateGuestProfile(guestId)
  await cleanupGuestData(guestId)
  await insertAssignments(guestId)

  const attemptBlueprints = buildAttemptBlueprints()
  const attempts = await insertAttempts(guestId, attemptBlueprints)
  const questions = await fetchQuestionBank(PRIMARY_EXAM_ID)

  const answerableBlueprints = attemptBlueprints.filter(
    (attempt) => attempt.generateAnswers
  )

  const answerGenerationResults = []
  for (const blueprint of answerableBlueprints) {
    const result = await generateAnswersForAttempt({
      attemptId: blueprint.id,
      accuracyByModule: blueprint.accuracyByModule,
      startedAt: blueprint.startedAt,
      completedAt: blueprint.completedAt,
      questions,
    })
    answerGenerationResults.push(result)
  }

  const latestResult = answerGenerationResults.at(-1)
  if (latestResult) {
    await insertMistakeBankEntries({
      userId: guestId,
      incorrectQuestionIds: latestResult.incorrectQuestionIds,
      referenceDate: latestResult.completedAt,
      allQuestionIds: questions.map((question) => question.id),
    })
  }

  await insertVocabData(guestId)

  console.log(`✅ Guest demo data refreshed for ${GUEST_EMAIL}`)
  console.log(
    `   Test attempts inserted: ${attemptBlueprints.filter((a) => a.status === 'completed').length} completed, ` +
      `${attemptBlueprints.filter((a) => a.status !== 'completed').length} in-progress`
  )
}

async function resolveGuestId(email) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (error) throw error
  return data?.id || null
}

async function updateGuestProfile(userId) {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      full_name: 'Avery Lee',
      grade_level: 11,
      target_score: 1520,
      show_correct_answers: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) {
    throw new Error(`Failed to update guest profile: ${error.message}`)
  }
}

async function cleanupGuestData(userId) {
  console.log('🧹 Cleaning previous guest data...')
  const { data: attempts, error: attemptsError } = await supabase
    .from('test_attempts')
    .select('id')
    .eq('user_id', userId)

  if (attemptsError) {
    throw new Error(`Failed to load guest attempts: ${attemptsError.message}`)
  }

  const attemptIds = (attempts || []).map((attempt) => attempt.id)
  if (attemptIds.length > 0) {
    const { error: answersError } = await supabase
      .from('user_answers')
      .delete()
      .in('attempt_id', attemptIds)

    if (answersError) {
      throw new Error(
        `Failed to delete guest answers: ${answersError.message}`
      )
    }
  }

  const deletions = [
    supabase.from('test_attempts').delete().eq('user_id', userId),
    supabase.from('exam_assignments').delete().eq('student_id', userId),
    supabase.from('mistake_bank').delete().eq('user_id', userId),
    supabase.from('vocab_entries').delete().eq('user_id', userId),
    supabase.from('vocab_sets').delete().eq('user_id', userId),
  ]

  for (const promise of deletions) {
    const { error } = await promise
    if (error) {
      throw new Error(`Failed during cleanup: ${error.message}`)
    }
  }
}

async function insertAssignments(userId) {
  console.log('📝 Creating fresh exam assignments...')
  const now = Date.now()
  const assignments = [
    {
      id: randomUUID(),
      exam_id: PRIMARY_EXAM_ID,
      student_id: userId,
      assigned_by: ADMIN_ASSIGNER_ID,
      assigned_at: new Date(now - 21 * DAY_MS).toISOString(),
      due_date: new Date(now - 5 * DAY_MS).toISOString(),
      is_active: true,
      show_results: true,
    },
    {
      id: randomUUID(),
      exam_id: MATH_FOCUS_EXAM_ID,
      student_id: userId,
      assigned_by: ADMIN_ASSIGNER_ID,
      assigned_at: new Date(now - 7 * DAY_MS).toISOString(),
      due_date: new Date(now + 3 * DAY_MS).toISOString(),
      is_active: true,
      show_results: true,
    },
    {
      id: randomUUID(),
      exam_id: ENGLISH_TWO_EXAM_ID,
      student_id: userId,
      assigned_by: ADMIN_ASSIGNER_ID,
      assigned_at: new Date(now - 2 * DAY_MS).toISOString(),
      due_date: new Date(now + 10 * DAY_MS).toISOString(),
      is_active: true,
      show_results: true,
    },
  ]

  const { error } = await supabase.from('exam_assignments').insert(assignments)
  if (error) {
    throw new Error(`Failed to insert assignments: ${error.message}`)
  }
}

function buildAttemptBlueprints() {
  const now = Date.now()
  const totalQuestionsByModule = {
    english1: 27,
    english2: 27,
    math1: 22,
    math2: 22,
  }

  const completedAttempts = [
    {
      label: 'Diagnostic Baseline',
      daysAgo: 34,
      durationMinutes: 125,
      finalScores: { overall: 1210, english: 620, math: 590 },
      accuracyByModule: { english1: 0.65, english2: 0.66, math1: 0.64, math2: 0.62 },
    },
    {
      label: 'Unit Review',
      daysAgo: 24,
      durationMinutes: 128,
      finalScores: { overall: 1290, english: 650, math: 640 },
      accuracyByModule: { english1: 0.72, english2: 0.74, math1: 0.73, math2: 0.72 },
    },
    {
      label: 'Timed Mock #1',
      daysAgo: 16,
      durationMinutes: 131,
      finalScores: { overall: 1360, english: 675, math: 685 },
      accuracyByModule: { english1: 0.78, english2: 0.79, math1: 0.78, math2: 0.77 },
    },
    {
      label: 'Timed Mock #2',
      daysAgo: 6.5,
      durationMinutes: 75,
      finalScores: { overall: 1430, english: 700, math: 730 },
      accuracyByModule: { english1: 0.82, english2: 0.84, math1: 0.82, math2: 0.81 },
    },
    {
      label: 'Focused Finish Line',
      daysAgo: 5.2,
      durationMinutes: 110,
      finalScores: { overall: 1455, english: 700, math: 755 },
      accuracyByModule: { english1: 0.79, english2: 0.8, math1: 0.81, math2: 0.79 },
    },
    {
      label: 'Weekend Simulation',
      daysAgo: 4.2,
      durationMinutes: 185,
      finalScores: { overall: 1480, english: 720, math: 760 },
      accuracyByModule: { english1: 0.85, english2: 0.86, math1: 0.86, math2: 0.85 },
      generateAnswers: true,
    },
    {
      label: 'Friday Sunset Sprint',
      daysAgo: 3.3,
      durationMinutes: 60,
      finalScores: { overall: 1475, english: 710, math: 765 },
      accuracyByModule: { english1: 0.83, english2: 0.84, math1: 0.83, math2: 0.82 },
    },
    {
      label: 'Section Shuffle',
      daysAgo: 2.2,
      durationMinutes: 210,
      finalScores: { overall: 1495, english: 720, math: 775 },
      accuracyByModule: { english1: 0.86, english2: 0.86, math1: 0.85, math2: 0.84 },
    },
    {
      label: 'Dress Rehearsal',
      daysAgo: 1.2,
      durationMinutes: 150,
      finalScores: { overall: 1520, english: 740, math: 780 },
      accuracyByModule: { english1: 0.9, english2: 0.88, math1: 0.88, math2: 0.87 },
      generateAnswers: true,
    },
    {
      label: 'Sunrise Booster',
      daysAgo: 0.6,
      durationMinutes: 95,
      finalScores: { overall: 1530, english: 750, math: 780 },
      accuracyByModule: { english1: 0.91, english2: 0.9, math1: 0.9, math2: 0.88 },
    },
  ]

  const attempts = completedAttempts.map((attempt) => {
    const timestampBundle = computeTimestamps(now, attempt.daysAgo, attempt.durationMinutes)
    const moduleScores = buildModuleScores(
      attempt.accuracyByModule,
      totalQuestionsByModule
    )
    return {
      id: randomUUID(),
      examId: PRIMARY_EXAM_ID,
      status: 'completed',
      label: attempt.label,
      startedAt: timestampBundle.startedAt,
      completedAt: timestampBundle.completedAt,
      createdAt: timestampBundle.createdAt,
      updatedAt: timestampBundle.completedAt,
      durationSeconds: attempt.durationMinutes * 60,
      finalScores: attempt.finalScores,
      accuracyByModule: attempt.accuracyByModule,
      moduleScores,
      generateAnswers: Boolean(attempt.generateAnswers),
      timeSpent: buildTimeSpent(attempt.durationMinutes),
      currentQuestionNumber: 98,
    }
  })

  attempts.push({
    id: randomUUID(),
    examId: MATH_FOCUS_EXAM_ID,
    status: 'in_progress',
    label: 'Math Remix Drill',
    startedAt: new Date(now - 0.8 * DAY_MS).toISOString(),
    completedAt: null,
    createdAt: new Date(now - 0.9 * DAY_MS).toISOString(),
    updatedAt: new Date(now - 0.2 * DAY_MS).toISOString(),
    durationSeconds: 70 * 60,
    finalScores: null,
    accuracyByModule: { math1: 0.4, math2: 0.35 },
    moduleScores: { english1: 0, english2: 0, math1: 9, math2: 7 },
    generateAnswers: false,
    timeSpent: {
      english1: 0,
      english2: 0,
      math1: 32 * 60,
      math2: 28 * 60,
    },
    currentModule: 'math2',
    currentQuestionNumber: 64,
  })

  return attempts
}

function computeTimestamps(now, daysAgo, durationMinutes) {
  const completedAt = new Date(now - daysAgo * DAY_MS)
  completedAt.setHours(11 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 50), 0, 0)
  const startedAt = new Date(
    completedAt.getTime() - durationMinutes * 60 * 1000
  )
  const createdAt = new Date(startedAt.getTime() - 15 * 60 * 1000)
  return {
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    createdAt: createdAt.toISOString(),
  }
}

function buildModuleScores(accuracyMap, totals) {
  const moduleScores = {}
  for (const [module, total] of Object.entries(totals)) {
    const ratio = accuracyMap[module] ?? 0
    moduleScores[module] = Math.max(
      0,
      Math.min(total, Math.round(total * ratio))
    )
  }
  return moduleScores
}

function buildTimeSpent(durationMinutes) {
  const totalSeconds = durationMinutes * 60
  const distribution = {
    english1: 30 * 60,
    english2: 31 * 60,
    math1: 32 * 60,
    math2: 33 * 60,
  }
  const factor = totalSeconds / Object.values(distribution).reduce((a, b) => a + b, 0)
  const scaled = {}
  for (const [module, seconds] of Object.entries(distribution)) {
    scaled[module] = Math.round(seconds * factor)
  }
  return scaled
}

async function insertAttempts(userId, attemptBlueprints) {
  console.log('📊 Inserting curated test attempts...')
  const payload = attemptBlueprints.map((attempt) => ({
    id: attempt.id,
    user_id: userId,
    exam_id: attempt.examId,
    status: attempt.status,
    current_module: attempt.currentModule || null,
    current_question_number: attempt.currentQuestionNumber || 1,
    started_at: attempt.startedAt,
    completed_at: attempt.completedAt,
    created_at: attempt.createdAt,
    updated_at: attempt.updatedAt || attempt.completedAt || attempt.startedAt,
    expires_at: null,
    is_practice_mode: false,
    time_spent: attempt.timeSpent,
    total_score: attempt.finalScores?.overall || 0,
    module_scores: attempt.moduleScores,
    final_scores: attempt.finalScores,
  }))

  const { error } = await supabase.from('test_attempts').insert(payload)
  if (error) {
    throw new Error(`Failed to insert attempts: ${error.message}`)
  }
  return attemptBlueprints
}

async function fetchQuestionBank(examId) {
  const { data, error } = await supabase
    .from('questions')
    .select(
      'id, module_type, question_type, question_number, correct_answer, options'
    )
    .eq('exam_id', examId)
    .order('module_type', { ascending: true })
    .order('question_number', { ascending: true })

  if (error) {
    throw new Error(`Failed to load questions for exam ${examId}: ${error.message}`)
  }
  return data || []
}

async function generateAnswersForAttempt({
  attemptId,
  accuracyByModule,
  startedAt,
  completedAt,
  questions,
}) {
  if (!questions.length) {
    console.warn('No questions available to generate answers - skipping.')
    return { incorrectQuestionIds: [], completedAt }
  }

  const moduleGroups = questions.reduce((acc, question) => {
    if (!acc[question.module_type]) {
      acc[question.module_type] = []
    }
    acc[question.module_type].push(question)
    return acc
  }, {})

  const answerRows = []
  const incorrectQuestionIds = []

  let answerCursor = new Date(startedAt).getTime()
  for (const [module, moduleQuestions] of Object.entries(moduleGroups)) {
    const accuracy = accuracyByModule[module] ?? 0
    const desiredCorrect = Math.min(
      moduleQuestions.length,
      Math.max(0, Math.round(moduleQuestions.length * accuracy))
    )
    let correctSoFar = 0

    moduleQuestions.forEach((question) => {
      const shouldBeCorrect = correctSoFar < desiredCorrect
      if (shouldBeCorrect) correctSoFar += 1

      const answerValue = shouldBeCorrect
        ? getCorrectAnswer(question)
        : getIncorrectAnswer(question)

      const timeSpentSeconds = module.startsWith('math')
        ? randomInt(65, 95)
        : randomInt(45, 75)

      answerCursor += timeSpentSeconds * 1000

      const answeredAt = new Date(answerCursor).toISOString()
      answerRows.push({
        id: randomUUID(),
        attempt_id: attemptId,
        question_id: question.id,
        user_answer: answerValue,
        is_correct: shouldBeCorrect,
        time_spent_seconds: timeSpentSeconds,
        answered_at: answeredAt,
        viewed_correct_answer_at: null,
      })

      if (!shouldBeCorrect) {
        incorrectQuestionIds.push(question.id)
      }
    })
  }

  for (const chunk of chunkArray(answerRows, 50)) {
    const { error } = await supabase.from('user_answers').insert(chunk)
    if (error) {
      throw new Error(`Failed to insert generated answers: ${error.message}`)
    }
  }

  return { incorrectQuestionIds, completedAt }
}

function getCorrectAnswer(question) {
  return question.correct_answer || 'A'
}

function getIncorrectAnswer(question) {
  if (question.question_type === 'multiple_choice' && question.options) {
    const keys = Object.keys(question.options)
    const wrongKey =
      keys.find((key) => key !== question.correct_answer) || keys[0] || 'A'
    return wrongKey
  }

  if (question.question_type === 'grid_in') {
    const value = parseFloat(question.correct_answer)
    if (Number.isFinite(value)) {
      return (value + 5).toString()
    }
  }

  return 'Z'
}

async function insertMistakeBankEntries({
  userId,
  incorrectQuestionIds,
  referenceDate,
  allQuestionIds = [],
}) {
  if (!incorrectQuestionIds.length) return

  const uniqueQuestionIds = Array.from(new Set(incorrectQuestionIds))
  if (!uniqueQuestionIds.length) return

  const recentSlice = uniqueQuestionIds.slice(0, 8)
  console.log('🔁 Seeding mistake bank entries...')

  const { data: existingMistakes, error: existingError } = await supabase
    .from('mistake_bank')
    .select('question_id')
    .in('question_id', recentSlice)

  if (existingError) {
    throw new Error(
      `Failed to check existing mistakes: ${existingError.message}`
    )
  }

  const alreadyUsed = new Set(
    (existingMistakes || []).map((row) => row.question_id)
  )
  let filteredIds = recentSlice.filter((id) => !alreadyUsed.has(id))

  if (!filteredIds.length && allQuestionIds.length) {
    const { data: takenForExam, error: takenError } = await supabase
      .from('mistake_bank')
      .select('question_id')
      .in('question_id', allQuestionIds)

    if (takenError) {
      throw new Error(
        `Failed to fetch fallback mistakes: ${takenError.message}`
      )
    }

    const takenSet = new Set(
      (takenForExam || []).map((row) => row.question_id)
    )
    filteredIds = allQuestionIds.filter((id) => !takenSet.has(id)).slice(0, 6)
    if (filteredIds.length) {
      console.log(
        `   Using ${filteredIds.length} fallback questions for mistake bank.`
      )
    }
  }

  if (!filteredIds.length) {
    console.log('   Skipping mistake entries (no unique questions available)')
    return
  }

  const baseDate = new Date(referenceDate).getTime()

  const rows = filteredIds.map((questionId, index) => {
    const status = index < 5 ? 'unmastered' : 'mastered'
    const firstMistake = new Date(baseDate - (index + 1) * DAY_MS).toISOString()
    const lastReviewed =
      status === 'mastered'
        ? new Date(baseDate - index * (DAY_MS / 2)).toISOString()
        : null

    return {
      user_id: userId,
      question_id: questionId,
      status,
      first_mistaken_at: firstMistake,
      last_reviewed_at: lastReviewed,
    }
  })

  const { error } = await supabase.from('mistake_bank').insert(rows)
  if (error) {
    throw new Error(`Failed to seed mistake bank: ${error.message}`)
  }
}

async function insertVocabData(userId) {
  console.log('📚 Creating vocab study sets...')
  const vocabSets = [
    {
      title: 'Critical Reading Power Words',
      words: [
        { term: 'cogent', definition: 'Logical and persuasive in its clarity.' },
        { term: 'didactic', definition: 'Intended to teach, often patronizingly.' },
        { term: 'lucid', definition: 'Easily understood; clear.' },
        { term: 'nuance', definition: 'A subtle distinction or variation.' },
        { term: 'trenchant', definition: 'Sharply perceptive or insightful.' },
        { term: 'resolute', definition: 'Purposeful, determined, and unwavering.' },
      ],
    },
    {
      title: 'Math & Data Essentials',
      words: [
        { term: 'derivative', definition: 'Instantaneous rate of change of a function.' },
        { term: 'logarithm', definition: 'Inverse operation to exponentiation.' },
        { term: 'vector', definition: 'Quantity with magnitude and direction.' },
        { term: 'asymptote', definition: 'Line a curve approaches but never touches.' },
        { term: 'median', definition: 'Middle value in an ordered data set.' },
        { term: 'variance', definition: 'Average degree to which each point differs from the mean.' },
      ],
    },
  ]

  const setPayload = vocabSets.map((set) => ({
    user_id: userId,
    title: set.title,
    description: null,
  }))

  const { data: insertedSets, error: setError } = await supabase
    .from('vocab_sets')
    .insert(setPayload)
    .select()

  if (setError) {
    throw new Error(`Failed to create vocab sets: ${setError.message}`)
  }

  const entries = []
  const now = Date.now()
  insertedSets.forEach((set, index) => {
    const words = vocabSets[index].words
    words.forEach((word, wordIndex) => {
      const createdAt = new Date(now - (wordIndex + 5) * DAY_MS).toISOString()
      const nextReview = new Date(now + (wordIndex + 1) * DAY_MS).toISOString()
      entries.push({
        set_id: set.id,
        user_id: userId,
        term: capitalize(word.term),
        definition: word.definition,
        example_sentence: null,
        mastery_level: wordIndex % 3,
        last_reviewed_at: createdAt,
        created_at: createdAt,
        image_url: null,
        next_review_date: nextReview,
        review_interval: 2 + (wordIndex % 4),
      })
    })
  })

  const { error: entriesError } = await supabase
    .from('vocab_entries')
    .insert(entries)

  if (entriesError) {
    throw new Error(`Failed to create vocab entries: ${entriesError.message}`)
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function chunkArray(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

main().catch((error) => {
  console.error('❌ Demo seed failed:', error)
  process.exit(1)
})
