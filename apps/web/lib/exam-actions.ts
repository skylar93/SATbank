'use server'

import { createClient } from './supabase/server'
import { revalidatePath } from 'next/cache'
// Temporary local database type definition
interface Database {
  public: {
    Tables: {
      exams: {
        Row: any
        Insert: any
        Update: any
      }
      test_attempts: {
        Row: any
        Insert: any
        Update: any
      }
      user_profiles: {
        Row: any
        Insert: any
        Update: any
      }
    }
  }
}

// Helper function for admin check
async function checkAdminAuth(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized: No user found.')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin role required.')
  }

  return user
}

export async function updateExamCurve(
  examId: string,
  curveType: 'english' | 'math',
  curveId: number | null
) {
  const supabase = createClient()
  await checkAdminAuth(supabase)

  const updateData =
    curveType === 'english'
      ? { english_scoring_curve_id: curveId }
      : { math_scoring_curve_id: curveId }

  const { error } = await supabase
    .from('exams')
    .update(updateData)
    .eq('id', examId)

  if (error) {
    return { success: false, message: error.message }
  }

  revalidatePath('/admin/exams') // Crucial: This tells Next.js to refresh the data on this page
  return { success: true }
}

export async function updateAnswerVisibilityForAttempt(
  examId: string, // We operate on the exam level for bulk updates
  visibility: 'hidden' | 'immediate' | 'scheduled',
  releaseDate?: string | null
) {
  const supabase = createClient()
  await checkAdminAuth(supabase)

  let updateData: any
  if (visibility === 'hidden') {
    updateData = { answers_visible: false, answers_visible_after: null }
  } else if (visibility === 'immediate') {
    updateData = { answers_visible: true, answers_visible_after: null }
  } else if (visibility === 'scheduled' && releaseDate) {
    updateData = { answers_visible: false, answers_visible_after: releaseDate }
  } else {
    return { success: false, message: 'Invalid visibility option.' }
  }

  const { error } = await supabase
    .from('test_attempts')
    .update(updateData)
    .eq('exam_id', examId)

  if (error) {
    return { success: false, message: error.message }
  }

  revalidatePath('/admin/exams')
  return { success: true }
}

export async function createTestAttempt(attempt: any) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.log('🚨 No user found in createTestAttempt')
    throw new Error('Unauthorized: No user found.')
  }

  console.log('✅ User found in createTestAttempt:', user.id)

  const { data, error } = await supabase
    .from('test_attempts')
    .insert({
      ...attempt,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createExam(formData: FormData) {
  const supabase = createClient()
  await checkAdminAuth(supabase)

  const title = formData.get('title') as string
  const description = formData.get('description') as string

  // Validate the input
  if (!title || title.trim().length === 0) {
    return { success: false, message: 'Exam title is required.' }
  }

  // Insert the new exam into the database
  const { data: newExam, error } = await supabase
    .from('exams')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    return { success: false, message: `Database error: ${error.message}` }
  }

  // Invalidate the cache for the exam list page
  revalidatePath('/admin/exams')

  // Return the new exam data, including its ID
  return { success: true, newExam }
}

export async function addQuestionToExam(examId: string) {
  const supabase = createClient()
  await checkAdminAuth(supabase)

  try {
    // For simplicity, we'll add to the last module or a default one.
    // A more advanced implementation could let the user choose.
    const defaultModule = 'english1'

    // 1. Find the highest existing question number in that module
    const { data: lastQuestion, error: numError } = await supabase
      .from('questions')
      .select('question_number')
      .eq('exam_id', examId)
      .eq('module_type', defaultModule)
      .order('question_number', { ascending: false })
      .limit(1)
      .single()

    if (numError && numError.code !== 'PGRST116') {
      // Ignore 'no rows found' error
      throw numError
    }
    const nextQuestionNumber = (lastQuestion?.question_number || 0) + 1

    // 2. Create the new question with default content
    const { data: newQuestion, error: insertError } = await supabase
      .from('questions')
      .insert({
        exam_id: examId,
        question_number: nextQuestionNumber,
        module_type: defaultModule,
        question_text:
          '### New Question\n\nThis is a new placeholder question. Click "Edit" to modify its content.',
        question_type: 'multiple_choice',
        difficulty_level: 'medium',
        options: {
          A: 'Option A',
          B: 'Option B',
          C: 'Option C',
          D: 'Option D',
        },
        correct_answer: 'A',
        topic_tags: ['new-question'],
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    // 3. Revalidate paths to refresh data on relevant pages
    revalidatePath(`/admin/exams/${examId}/preview`)
    revalidatePath('/admin/questions')

    return { success: true, newQuestion }
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to add question: ${error.message}`,
    }
  }
}

export async function activateExam(examId: string) {
  const supabase = createClient()
  await checkAdminAuth(supabase)

  const { error } = await supabase
    .from('exams')
    .update({ is_active: true })
    .eq('id', examId)

  if (error) {
    return { success: false, message: error.message }
  }

  revalidatePath('/admin/exams')
  return { success: true }
}

export async function assignExamToStudents(
  examId: string,
  studentIds: string[],
  dueDate?: string
) {
  const supabase = createClient()
  const admin = await checkAdminAuth(supabase)

  try {
    // Create assignment records for each student
    const assignments = studentIds.map((studentId) => ({
      exam_id: examId,
      student_id: studentId,
      assigned_by: admin.id,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      is_active: true,
    }))

    const { error } = await supabase
      .from('exam_assignments')
      .insert(assignments)

    if (error) {
      throw error
    }

    revalidatePath('/admin/exams')
    return { success: true, assignedCount: studentIds.length }
  } catch (error: any) {
    return { success: false, message: error.message }
  }
}

interface CalculatePotentialScoreRequest {
  originalAttemptId: string
  newAnswers: Array<{
    questionId: string
    answer: string
  }>
}

interface CalculatePotentialScoreResponse {
  success: boolean
  originalScore?: number
  potentialScore?: number
  improvement?: number
  originalCorrect?: number
  newCorrect?: number
  totalQuestions?: number
  message?: string
  error?: string
}

export async function calculatePotentialScore(
  request: CalculatePotentialScoreRequest
): Promise<CalculatePotentialScoreResponse> {
  try {
    const supabase = createClient()
    const { originalAttemptId, newAnswers } = request

    console.log(
      `[calculate-potential-score] Processing for attempt ${originalAttemptId} with ${newAnswers.length} new answers`
    )

    // 1. Get original attempt data and check if review was already taken
    const { data: originalAttempt, error: attemptError } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('id', originalAttemptId)
      .single()

    if (attemptError || !originalAttempt) {
      throw new Error('Original attempt not found')
    }

    if (originalAttempt.review_attempt_taken) {
      throw new Error('Second chance has already been used for this attempt')
    }

    // 2. Get all original answers for this attempt
    const { data: originalAnswers, error: originalAnswersError } =
      await supabase
        .from('user_answers')
        .select('question_id, user_answer, is_correct')
        .eq('attempt_id', originalAttemptId)

    if (originalAnswersError || !originalAnswers) {
      console.error(
        '[calculate-potential-score] Error fetching original answers:',
        originalAnswersError
      )
      throw new Error('Failed to fetch original answers')
    }

    // 3. Get question details
    const questionIds = originalAnswers.map((a) => a.question_id)
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id, correct_answer, correct_answers, question_type, points')
      .in('id', questionIds)

    if (questionsError || !questions) {
      console.error(
        '[calculate-potential-score] Error fetching questions:',
        questionsError
      )
      throw new Error('Failed to fetch question details')
    }

    // Create a map for easier lookup
    const questionMap = new Map()
    questions.forEach((q) => questionMap.set(q.id, q))

    // 4. Calculate original score
    const originalCorrect = originalAnswers.filter((a) => a.is_correct).length
    let originalRawScore = 0

    originalAnswers.forEach((answer) => {
      if (answer.is_correct) {
        const question = questionMap.get(answer.question_id)
        originalRawScore += question?.points || 1
      }
    })

    console.log(
      `[calculate-potential-score] Original: ${originalCorrect}/${originalAnswers.length} correct, raw score: ${originalRawScore}`
    )

    // 5. Check correctness of new answers
    let newlyCorrectCount = 0
    let newRawScoreIncrease = 0

    for (const newAnswer of newAnswers) {
      const originalAnswer = originalAnswers.find(
        (a) => a.question_id === newAnswer.questionId
      )
      if (!originalAnswer) {
        console.warn(
          `[calculate-potential-score] Question ${newAnswer.questionId} not found in original answers`
        )
        continue
      }

      const question = questionMap.get(newAnswer.questionId)
      if (!question) {
        console.warn(
          `[calculate-potential-score] Question details for ${newAnswer.questionId} not found`
        )
        continue
      }

      const isNewAnswerCorrect = checkAnswer(question, newAnswer.answer)

      // Only count if originally incorrect but now correct
      if (!originalAnswer.is_correct && isNewAnswerCorrect) {
        newlyCorrectCount++
        newRawScoreIncrease += question.points || 1
      }
    }

    const potentialCorrect = originalCorrect + newlyCorrectCount
    const potentialRawScore = originalRawScore + newRawScoreIncrease

    console.log(
      `[calculate-potential-score] Potential: ${potentialCorrect}/${originalAnswers.length} correct, raw score: ${potentialRawScore}`
    )

    // 6. Convert raw scores to SAT scores
    const originalSATScore = rawToSATScore(
      originalRawScore,
      originalAnswers.length
    )
    const potentialSATScore = rawToSATScore(
      potentialRawScore,
      originalAnswers.length
    )
    const improvement = potentialSATScore - originalSATScore

    console.log(
      `[calculate-potential-score] SAT Scores - Original: ${originalSATScore}, Potential: ${potentialSATScore}, Improvement: ${improvement}`
    )

    // 7. Mark review attempt as taken and store the calculated scores
    const { error: updateError } = await supabase
      .from('test_attempts')
      .update({
        review_attempt_taken: true,
        review_potential_score: potentialSATScore,
        review_improvement: improvement,
      })
      .eq('id', originalAttemptId)

    if (updateError) {
      console.error(
        '[calculate-potential-score] Failed to mark review as taken:',
        updateError
      )
      throw new Error('Failed to mark review as taken')
    }

    // 8. Return results
    const response: CalculatePotentialScoreResponse = {
      success: true,
      originalScore: originalSATScore,
      potentialScore: potentialSATScore,
      improvement,
      originalCorrect,
      newCorrect: potentialCorrect,
      totalQuestions: originalAnswers.length,
      message:
        improvement > 0
          ? `Great job! You improved by ${improvement} points!`
          : improvement === 0
            ? 'Keep practicing! Your potential score remained the same.'
            : `Don't worry - learning is a process. Keep practicing!`,
    }

    return response
  } catch (error: any) {
    console.error('[calculate-potential-score] Error:', error)

    return {
      success: false,
      error: error.message || 'Internal server error',
    }
  }
}

// Helper function to check if answer is correct
function checkAnswer(question: any, userAnswer: string): boolean {
  if (!userAnswer || !question.correct_answer) return false

  if (question.question_type === 'grid_in') {
    // Import the grid-in validator
    const { validateGridInAnswer } = require('./grid-in-validator')
    const result = validateGridInAnswer(question, userAnswer)
    return result.isCorrect
  }

  // For multiple choice, direct comparison
  return (
    String(question.correct_answer).trim().toLowerCase() ===
    String(userAnswer).trim().toLowerCase()
  )
}

// Simplified raw score to SAT score conversion
function rawToSATScore(rawScore: number, totalQuestions: number): number {
  // This is a simplified conversion - in production you'd use official SAT scoring tables
  const percentage = rawScore / totalQuestions

  if (percentage >= 0.95) return 800
  if (percentage >= 0.9) return 750
  if (percentage >= 0.85) return 700
  if (percentage >= 0.8) return 650
  if (percentage >= 0.75) return 600
  if (percentage >= 0.7) return 550
  if (percentage >= 0.65) return 500
  if (percentage >= 0.6) return 450
  if (percentage >= 0.55) return 400
  if (percentage >= 0.5) return 350
  if (percentage >= 0.45) return 300
  if (percentage >= 0.4) return 250

  return 200
}

export async function deleteInProgressExamAttempt(examId: string) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Unauthorized: No user found.')
  }

  // Find the in-progress attempt for this user and exam
  const { data: attempt, error: findError } = await supabase
    .from('test_attempts')
    .select('id, status')
    .eq('exam_id', examId)
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .single()

  if (findError || !attempt) {
    return {
      success: false,
      message: 'No in-progress attempt found to delete.',
    }
  }

  // Delete associated user_answers first (foreign key constraint)
  const { error: answersError } = await supabase
    .from('user_answers')
    .delete()
    .eq('attempt_id', attempt.id)

  if (answersError) {
    return {
      success: false,
      message: `Failed to delete answers: ${answersError.message}`,
    }
  }

  // Delete the test attempt
  const { error: attemptError } = await supabase
    .from('test_attempts')
    .delete()
    .eq('id', attempt.id)

  if (attemptError) {
    return {
      success: false,
      message: `Failed to delete attempt: ${attemptError.message}`,
    }
  }

  return {
    success: true,
    message: 'In-progress exam attempt deleted successfully.',
  }
}

export async function createExamFromModules(data: {
  title: string
  description: string
  templateId: string
  moduleAssignments: Record<string, string>
  timeLimits?: Record<string, number>
}) {
  const supabase = createClient()
  await checkAdminAuth(supabase)

  try {
    // 1. Get template info to determine which curves are needed
    const { data: template, error: templateError } = await supabase
      .from('exam_templates')
      .select('scoring_groups')
      .eq('id', data.templateId)
      .single()

    if (templateError) {
      throw new Error(`Failed to fetch template: ${templateError.message}`)
    }

    // 2. Determine which curves are needed based on scoring groups
    const hasEnglishModules = template.scoring_groups?.english?.length > 0
    const hasMathModules = template.scoring_groups?.math?.length > 0

    // 3. Create the parent exam record with appropriate curves only
    const examData: any = {
      title: data.title,
      description: data.description,
      template_id: data.templateId,
      module_composition: data.moduleAssignments,
      is_active: true, // Start as active so it can be assigned immediately
    }

    // Only assign curves if the template actually has those modules
    if (hasEnglishModules) {
      examData.english_scoring_curve_id = 1 // Default English curve
    }
    if (hasMathModules) {
      examData.math_scoring_curve_id = 2 // Default Math curve
    }

    // 4. Add time limits if provided
    if (data.timeLimits) {
      examData.time_limits = data.timeLimits
    }

    const { data: newExam, error: examError } = await supabase
      .from('exams')
      .insert(examData)
      .select()
      .single()

    if (examError) {
      throw examError
    }

    const newExamId = newExam.id

    // 5. Populate the exam_questions junction table
    for (const [moduleType, sourceExamId] of Object.entries(
      data.moduleAssignments
    )) {
      // Get all questions from the source module
      const { data: sourceQuestions, error: questionsError } = await supabase
        .from('questions')
        .select('id, question_number')
        .eq('exam_id', sourceExamId)
        .eq('module_type', moduleType)
        .order('question_number')

      if (questionsError) {
        throw questionsError
      }

      // Insert records into exam_questions junction table
      const examQuestionRecords = sourceQuestions.map((question) => ({
        exam_id: newExamId,
        question_id: question.id,
        question_number: question.question_number,
        module_type: moduleType,
      }))

      if (examQuestionRecords.length > 0) {
        const { error: junctionError } = await supabase
          .from('exam_questions')
          .insert(examQuestionRecords)

        if (junctionError) {
          throw junctionError
        }
      }
    }

    // 6. Revalidate the admin exams page
    revalidatePath('/admin/exams')

    return { success: true, examId: newExamId }
  } catch (error: any) {
    console.error('Error creating exam from modules:', error)
    return {
      success: false,
      error: `Failed to create exam: ${error.message}`,
    }
  }
}
