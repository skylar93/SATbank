import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'

async function createPracticeExam(questionIds: string[], userId: string) {
  // Create a practice exam from selected questions
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .insert({
      title: `Practice Quiz - ${new Date().toLocaleDateString()}`,
      description: 'Custom practice quiz from mistake notebook',
      is_mock_exam: false,
      is_active: true,
      is_custom_assignment: true,
      total_questions: questionIds.length,
      time_limits: {
        english1: 35 * 60, // 35 minutes
        english2: 35 * 60,
        math1: 35 * 60,
        math2: 35 * 60,
      },
      created_by: userId,
    })
    .select()
    .single()

  if (examError) {
    console.error('Error creating practice exam:', examError)
    throw new Error('Failed to create practice exam')
  }

  // Link questions to the exam
  const examQuestions = questionIds.map((questionId) => ({
    exam_id: exam.id,
    question_id: questionId,
  }))

  const { error: linkError } = await supabase
    .from('exam_questions')
    .insert(examQuestions)

  if (linkError) {
    console.error('Error linking questions to exam:', linkError)
    throw new Error('Failed to link questions to exam')
  }

  // Create a test attempt
  const { data: attempt, error: attemptError } = await supabase
    .from('test_attempts')
    .insert({
      user_id: userId,
      exam_id: exam.id,
      status: 'not_started',
      is_practice_mode: true,
    })
    .select()
    .single()

  if (attemptError) {
    console.error('Error creating test attempt:', attemptError)
    throw new Error('Failed to create test attempt')
  }

  return attempt.id
}

export default async function PracticeQuizPage({
  searchParams,
}: {
  searchParams: { q?: string | string[] }
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // Get question IDs from search params
  const questionIds = Array.isArray(searchParams.q)
    ? searchParams.q
    : searchParams.q
      ? [searchParams.q]
      : []

  if (questionIds.length === 0) {
    notFound()
  }

  try {
    // Create a practice exam and attempt
    const attemptId = await createPracticeExam(questionIds, user.id)

    // Redirect to the exam page
    redirect(`/student/practice/${attemptId}`)
  } catch (error) {
    console.error('Error setting up practice quiz:', error)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to Create Practice Quiz
          </h1>
          <p className="text-gray-600 mb-4">
            There was an error setting up your practice quiz. Please try again.
          </p>
          <a
            href="/student/mistake-notebook"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            Back to Mistake Notebook
          </a>
        </div>
      </div>
    )
  }
}
