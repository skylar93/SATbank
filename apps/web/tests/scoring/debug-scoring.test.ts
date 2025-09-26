import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { ScoringService } from '../../lib/scoring-service'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('Debug Scoring Issues', () => {
  it('should debug why scoring returns 0', async () => {
    // Get available templates first
    const { data: templates } = await supabase
      .from('exam_templates')
      .select('id, name, scoring_groups')
      .limit(3)

    console.log('📋 Available templates:', templates)

    // Get a real exam and ensure it has a template
    const { data: exams } = await supabase
      .from('exams')
      .select('id, title, template_id')
      .limit(5)

    console.log('📚 Available exams:', exams)
    expect(exams).toBeDefined()
    expect(exams!.length).toBeGreaterThan(0)

    // Find exam with questions and template
    let exam = null
    let questions = null

    for (const testExam of exams!) {
      const { data: examQuestions } = await supabase
        .from('questions')
        .select('id, question_number, module_type, correct_answer, points')
        .eq('exam_id', testExam.id)
        .limit(5)

      if (examQuestions && examQuestions.length > 0) {
        // Found an exam with questions
        exam = testExam
        questions = examQuestions

        // Ensure it has a template
        if (!exam.template_id && templates && templates.length > 0) {
          const englishTemplate = templates.find((t) => t.id === 'english_only')
          if (englishTemplate) {
            const { data: updatedExam } = await supabase
              .from('exams')
              .update({ template_id: englishTemplate.id })
              .eq('id', exam.id)
              .select('id, title, template_id')
              .single()

            exam = updatedExam || exam
            console.log(
              `🔧 Updated exam ${exam.title} with template ${englishTemplate.name}`
            )
          }
        }

        if (exam.template_id) {
          break // Found exam with both questions and template
        }
      }
    }

    if (!exam || !questions || questions.length === 0) {
      throw new Error('No exam found with both questions and template')
    }

    console.log(
      `🎯 Testing with exam: ${exam.title} (template: ${exam.template_id})`
    )
    console.log(`📝 Questions found: ${questions.length}`)
    console.log(
      'Question details:',
      questions.map((q) => ({
        id: q.id,
        number: q.question_number,
        module: q.module_type,
        points: q.points,
        hasCorrectAnswer: !!q.correct_answer,
      }))
    )

    expect(questions).toBeDefined()
    expect(questions!.length).toBeGreaterThan(0)

    // Check if there are existing users we can use, or create a test user
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id')
      .limit(1)

    let testUserId: string

    if (existingUsers && existingUsers.length > 0) {
      testUserId = existingUsers[0].id
      console.log('🔄 Using existing user:', testUserId)
    } else {
      // Try to create a new test user
      testUserId = crypto.randomUUID()
      const { error: userError } = await supabase.from('users').insert({
        id: testUserId,
        email: `test-${Date.now()}@example.com`,
        created_at: new Date().toISOString(),
      })

      if (userError) {
        console.log(
          '⚠️ Could not create user, using UUID anyway:',
          userError.message
        )
        // Continue with the test - some setups might not have the users table constraint
      }
    }

    const { data: attempt, error: attemptError } = await supabase
      .from('test_attempts')
      .insert({
        user_id: testUserId,
        exam_id: exam.id,
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    console.log('📋 Created attempt:', attempt?.id)
    expect(attemptError).toBeNull()
    expect(attempt).toBeDefined()

    // Create some user answers with correct responses
    const userAnswers = questions!.slice(0, 3).map((q) => ({
      attempt_id: attempt!.id,
      question_id: q.id,
      user_answer: Array.isArray(q.correct_answer)
        ? q.correct_answer[0]
        : q.correct_answer,
      time_spent_seconds: 60,
      is_correct: true, // Manually set to true for debugging
    }))

    console.log('📝 Creating user answers:', userAnswers.length)

    const { error: answersError } = await supabase
      .from('user_answers')
      .insert(userAnswers)

    expect(answersError).toBeNull()

    // Verify the data was inserted
    const { data: insertedAnswers } = await supabase
      .from('user_answers')
      .select(
        `
        id,
        user_answer,
        is_correct,
        questions:question_id (
          module_type,
          points
        )
      `
      )
      .eq('attempt_id', attempt!.id)

    console.log(
      '📊 Inserted answers:',
      insertedAnswers?.map((a) => ({
        answer: a.user_answer,
        correct: a.is_correct,
        module: a.questions?.module_type,
        points: a.questions?.points,
      }))
    )

    // Now try scoring
    console.log('🔄 Calculating scores...')
    const finalScores = await ScoringService.calculateFinalScores(
      attempt!.id,
      true
    )

    console.log('📊 Final scores result:', finalScores)

    // Clean up
    await supabase.from('user_answers').delete().eq('attempt_id', attempt!.id)
    await supabase.from('test_attempts').delete().eq('id', attempt!.id)
    await supabase.from('users').delete().eq('id', testUserId)

    expect(finalScores.overall).toBeGreaterThan(0)
  })
})
