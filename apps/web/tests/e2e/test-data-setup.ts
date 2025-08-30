import { supabase } from '@/lib/supabase'

/**
 * Helper functions for setting up test data for E2E tests
 * These functions should be run before E2E tests to ensure test data exists
 */

export async function setupE2ETestData() {
  const testEmail = 'student@test.com'
  const testPassword = 'password123'

  // Check if test user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', testEmail)
    .single()

  let userId: string

  if (existingUser) {
    userId = existingUser.id
    console.log('Using existing test user:', userId)
  } else {
    // Create test user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    })

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`)
    }

    userId = authData.user.id
    console.log('Created new test user:', userId)
  }

  // Create or verify test exam exists
  const { data: existingExam } = await supabase
    .from('exams')
    .select('*')
    .eq('title', 'E2E Test Exam')
    .single()

  let examId: string

  if (existingExam) {
    examId = existingExam.id
    console.log('Using existing test exam:', examId)
  } else {
    // Create test exam
    const { data: examData, error: examError } = await supabase
      .from('exams')
      .insert({
        title: 'E2E Test Exam',
        description: 'Test exam for E2E testing',
        is_active: true,
        time_limits: {
          english1: 35,
          english2: 35,
          math1: 35,
          math2: 35
        }
      })
      .select()
      .single()

    if (examError || !examData) {
      throw new Error(`Failed to create test exam: ${examError?.message}`)
    }

    examId = examData.id

    // Create questions for the exam
    await createTestQuestions(examId, 'english1', 27)
    await createTestQuestions(examId, 'english2', 27)
    await createTestQuestions(examId, 'math1', 22)
    await createTestQuestions(examId, 'math2', 22)

    console.log('Created new test exam with questions:', examId)
  }

  // Ensure exam is assigned to test user
  const { data: existingAssignment } = await supabase
    .from('exam_assignments')
    .select('*')
    .eq('exam_id', examId)
    .eq('student_id', userId)
    .single()

  if (!existingAssignment) {
    const { error: assignmentError } = await supabase
      .from('exam_assignments')
      .insert({
        exam_id: examId,
        student_id: userId
      })

    if (assignmentError) {
      throw new Error(`Failed to assign exam to user: ${assignmentError.message}`)
    }

    console.log('Assigned exam to test user')
  }

  return {
    userId,
    examId,
    userEmail: testEmail,
    userPassword: testPassword
  }
}

async function createTestQuestions(examId: string, module: string, count: number) {
  const questions = []
  
  for (let i = 1; i <= count; i++) {
    // Create a mix of multiple choice and grid-in questions
    const isGridIn = module.startsWith('math') && i > count - 5 // Last 5 math questions are grid-in
    
    questions.push({
      exam_id: examId,
      module,
      question_number: i,
      question_text: `E2E Test Question ${i} for ${module}`,
      question_type: isGridIn ? 'grid_in' : 'multiple_choice',
      choices: isGridIn ? null : ['A) Option A', 'B) Option B', 'C) Option C', 'D) Option D'],
      correct_answer: isGridIn ? '42' : 'A',
      explanation: `Test explanation for question ${i}`
    })
  }

  const { error } = await supabase
    .from('questions')
    .insert(questions)

  if (error) {
    throw new Error(`Failed to create questions for ${module}: ${error.message}`)
  }
}

export async function cleanupE2ETestData() {
  // This function can be used to clean up test data if needed
  // Be careful with this in a shared testing environment
  
  const { data: testExam } = await supabase
    .from('exams')
    .select('id')
    .eq('title', 'E2E Test Exam')
    .single()

  if (testExam) {
    // Delete in reverse order due to foreign key constraints
    const { data: questionIds } = await supabase
      .from('questions')
      .select('id')
      .eq('exam_id', testExam.id)

    if (questionIds && questionIds.length > 0) {
      await supabase.from('user_answers').delete().in(
        'question_id',
        questionIds.map(q => q.id)
      )
    }
    
    await supabase.from('test_attempts').delete().eq('exam_id', testExam.id)
    await supabase.from('exam_assignments').delete().eq('exam_id', testExam.id)
    await supabase.from('questions').delete().eq('exam_id', testExam.id)
    await supabase.from('exams').delete().eq('id', testExam.id)
    
    console.log('Cleaned up E2E test data')
  }
}