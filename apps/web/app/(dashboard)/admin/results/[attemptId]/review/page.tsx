'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../../../../contexts/auth-context'
import { supabase } from '../../../../../../lib/supabase'
import ReviewPageClient from '../../../../student/results/[attemptId]/review/ReviewPageClient'
import type {
  Question,
  TestAttempt,
  UserAnswer,
  Exam,
} from '../../../../../../lib/exam-service'

interface QuestionWithMetadata extends Question {
  _exam_question_number?: number
  _module_type?: string
}

interface ReviewData {
  attempt: TestAttempt & { exams: Exam }
  exam: Exam
  questions: QuestionWithMetadata[]
  userAnswers: UserAnswer[]
}

export default function AdminReviewPage() {
  const params = useParams()
  const { user } = useAuth()
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const attemptId = params.attemptId as string

  useEffect(() => {
    if (user && attemptId) {
      checkAdminAccess()
    }
  }, [user, attemptId])

  const checkAdminAccess = async () => {
    if (!user) return

    try {
      // Check if user is admin
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError || !profileData) {
        throw new Error('Unable to verify user permissions')
      }

      if (profileData.role !== 'admin') {
        throw new Error('Admin access required')
      }

      // Admin has access, proceed to load data
      await loadReviewData()
    } catch (err: any) {
      console.error('Admin access check failed:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  const loadReviewData = async () => {
    if (!user) return

    try {
      // Get the test attempt with exam information (admin can access any attempt)
      const { data: attempt, error: attemptError } = await supabase
        .from('test_attempts')
        .select(
          `
          *,
          exams!inner(*)
        `
        )
        .eq('id', attemptId)
        .single()

      if (attemptError || !attempt) {
        throw new Error('Failed to load attempt data')
      }

      // Smart detection: Determine which system this exam uses
      const examSystem = attempt.exams.template_id ? 'template' : 'direct'
      console.log('🔍 [Admin] Exam system detected:', examSystem)
      console.log('🔍 [Admin] Template ID:', attempt.exams.template_id)
      console.log('🔍 [Admin] Exam ID:', attempt.exam_id)
      
      let allQuestions: QuestionWithMetadata[] = []
      
      if (examSystem === 'template') {
        // NEW SYSTEM: Template-based exam using exam_questions table
        console.log('🔍 [Admin] Loading questions via exam_questions table')
        const { data: examQuestions, error: examQuestionsError } = await supabase
          .from('exam_questions')
          .select(`
            question_id,
            module_type,
            question_number,
            questions(*)
          `)
          .eq('exam_id', attempt.exam_id)
          .order('question_number')
        
        if (examQuestionsError) {
          console.error('🚨 [Admin] exam_questions query error:', examQuestionsError)
          throw new Error(`Failed to load questions from exam_questions: ${examQuestionsError.message}`)
        }
        
        if (examQuestions) {
          // Extract questions from the joined data
          allQuestions = examQuestions
            .filter(eq => eq.questions) // Filter out any null questions
            .map(eq => ({
              ...(eq.questions as unknown as Question),
              // Add exam_questions metadata for context
              _exam_question_number: eq.question_number,
              _module_type: eq.module_type
            }))
          
          console.log('🔍 [Admin] Template system loaded questions:', allQuestions.length)
        }
      } else {
        // OLD SYSTEM: Direct exam_id connection in questions table
        console.log('🔍 [Admin] Loading questions via direct exam_id connection')
        const { data: questions, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('exam_id', attempt.exam_id)
          .order('question_number')
        
        if (questionsError) {
          console.error('🚨 [Admin] Direct questions query error:', questionsError)
          throw new Error(`Failed to load questions directly: ${questionsError.message}`)
        }
        
        allQuestions = questions || []
        console.log('🔍 [Admin] Direct system loaded questions:', allQuestions.length)
      }

      console.log('🔍 [Admin] Total questions loaded:', allQuestions.length)

      // Get user answers for this attempt
      const { data: userAnswers, error: answersError } = await supabase
        .from('user_answers')
        .select('*')
        .eq('attempt_id', attemptId)
        .order('question_id')

      if (answersError) {
        throw new Error('Failed to load user answers')
      }

      const reviewData: ReviewData = {
        attempt,
        exam: attempt.exams,
        questions: allQuestions,
        userAnswers: userAnswers || [],
      }

      setReviewData(reviewData)
    } catch (err: any) {
      console.error('Error loading review data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading exam review...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !reviewData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-red-900 mb-2">
              Error Loading Review
            </h3>
            <p className="text-red-700 mb-4">
              {error || 'Review data not found'}
            </p>
            <Link
              href={`/admin/results/${attemptId}`}
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Analysis
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ReviewPageClient
      reviewData={reviewData}
      showCorrectAnswers={true} // Admin always sees correct answers
      attemptId={attemptId}
      isAdminView={true} // Enable admin-specific features
    />
  )
}
