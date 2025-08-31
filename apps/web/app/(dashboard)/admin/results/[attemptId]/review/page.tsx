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

interface ReviewData {
  attempt: TestAttempt & { exams: Exam }
  exam: Exam
  questions: Question[]
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

      // Get all questions for this exam
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', attempt.exam_id)
        .order('question_number')

      if (questionsError) {
        throw new Error('Failed to load questions')
      }

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
        questions: questions || [],
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
