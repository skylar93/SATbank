import { supabase } from '@/lib/supabase'
import type { Exam, Question, User } from '@/lib/types'

export interface TestData {
  user: {
    id: string
    email: string
  }
  exam: Exam
  questions: {
    english1: Question[]
    english2: Question[]
    math1: Question[]
    math2: Question[]
  }
}

/**
 * Sets up test data for integration tests
 * Creates a test user, exam, and questions in the database
 */
export async function setupTestData(): Promise<TestData> {
  const testEmail = `test-user-${Date.now()}@example.com`
  const testPassword = 'test-password-123'
  
  // Create test user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  })

  if (authError || !authData.user) {
    throw new Error(`Failed to create test user: ${authError?.message}`)
  }

  // Create test exam
  const { data: examData, error: examError } = await supabase
    .from('exams')
    .insert({
      title: 'Integration Test Exam',
      description: 'A test exam for integration testing',
      is_active: true,
      time_limits: {
        english1: 35,
        english2: 35,
        math1: 35,
        math2: 35
      },
      created_by: authData.user.id
    })
    .select()
    .single()

  if (examError || !examData) {
    throw new Error(`Failed to create test exam: ${examError?.message}`)
  }

  // Create sample questions for each module
  const questions = {
    english1: await createTestQuestions(examData.id, 'english1', 27),
    english2: await createTestQuestions(examData.id, 'english2', 27),
    math1: await createTestQuestions(examData.id, 'math1', 22),
    math2: await createTestQuestions(examData.id, 'math2', 22)
  }

  // Assign exam to test user
  await supabase
    .from('exam_assignments')
    .insert({
      exam_id: examData.id,
      student_id: authData.user.id
    })

  return {
    user: {
      id: authData.user.id,
      email: testEmail
    },
    exam: examData,
    questions
  }
}

/**
 * Creates test questions for a specific module
 */
async function createTestQuestions(
  examId: string,
  module: string,
  count: number
): Promise<Question[]> {
  const questionsData = []
  
  for (let i = 1; i <= count; i++) {
    // Create a mix of multiple choice and grid-in questions
    const isGridIn = module.startsWith('math') && i > count - 5 // Last 5 math questions are grid-in
    
    const questionData = {
      exam_id: examId,
      module,
      question_number: i,
      question_text: `Test question ${i} for ${module}`,
      question_type: isGridIn ? 'grid_in' : 'multiple_choice',
      choices: isGridIn ? null : ['A) Option A', 'B) Option B', 'C) Option C', 'D) Option D'],
      correct_answer: isGridIn ? '42' : 'A',
      explanation: `This is the explanation for question ${i}`
    }
    
    questionsData.push(questionData)
  }

  const { data: questions, error } = await supabase
    .from('questions')
    .insert(questionsData)
    .select()

  if (error) {
    throw new Error(`Failed to create test questions: ${error.message}`)
  }

  return questions as Question[]
}

/**
 * Cleans up test data after integration tests
 */
export async function cleanupTestData(testData: TestData): Promise<void> {
  try {
    // Delete in reverse order due to foreign key constraints
    
    // Delete user answers
    await supabase
      .from('user_answers')
      .delete()
      .in('question_id', [
        ...testData.questions.english1.map(q => q.id),
        ...testData.questions.english2.map(q => q.id),
        ...testData.questions.math1.map(q => q.id),
        ...testData.questions.math2.map(q => q.id)
      ])

    // Delete test attempts
    await supabase
      .from('test_attempts')
      .delete()
      .eq('exam_id', testData.exam.id)

    // Delete exam assignments
    await supabase
      .from('exam_assignments')
      .delete()
      .eq('exam_id', testData.exam.id)

    // Delete questions
    await supabase
      .from('questions')
      .delete()
      .eq('exam_id', testData.exam.id)

    // Delete exam
    await supabase
      .from('exams')
      .delete()
      .eq('id', testData.exam.id)

    // Delete user (this will cascade delete related records)
    await supabase.auth.admin.deleteUser(testData.user.id)
    
  } catch (error) {
    console.warn('Error during cleanup, some test data may remain:', error)
  }
}

/**
 * Helper function to sign in as test user
 */
export async function signInAsTestUser(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: 'test-password-123'
  })
  
  if (error) {
    throw new Error(`Failed to sign in as test user: ${error.message}`)
  }
}

/**
 * Helper function to answer all questions correctly for testing
 */
export function getCorrectAnswerForQuestion(question: Question): string {
  if (question.question_type === 'grid_in') {
    return question.correct_answer || '42'
  }
  
  // For multiple choice, return the letter of the correct answer
  const correctAnswer = question.correct_answer
  if (typeof correctAnswer === 'string' && correctAnswer.match(/^[A-D]/)) {
    return correctAnswer.charAt(0)
  }
  
  return 'A' // Default fallback
}