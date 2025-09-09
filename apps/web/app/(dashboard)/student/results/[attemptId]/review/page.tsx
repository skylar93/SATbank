'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../../../../contexts/auth-context'
import { ExamService } from '../../../../../../lib/exam-service'
import { supabase } from '../../../../../../lib/supabase'
import ReviewPageClient from './ReviewPageClient'
import type {
  Question,
  TestAttempt,
  UserAnswer,
  Exam,
} from '../../../../../../lib/exam-service'
import {
  canShowAnswers,
  type TestAttemptWithVisibility,
} from '../../../../../../lib/answer-visibility'

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

export default function ReviewPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false)
  const [canShowResults, setCanShowResults] = useState(true)

  const attemptId = params.attemptId as string

  useEffect(() => {
    if (user && attemptId) {
      loadReviewData()
      checkAnswerVisibility()
      checkResultVisibility()
    }
  }, [user, attemptId])

  const checkAnswerVisibility = async () => {
    if (!user) return

    try {
      // Get the test attempt with answer visibility fields
      const { data: attempt, error } = await supabase
        .from('test_attempts')
        .select('id, answers_visible, answers_visible_after')
        .eq('id', attemptId)
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      if (attempt) {
        // Use the new visibility logic
        const canShow = canShowAnswers(attempt)
        setShowCorrectAnswers(canShow)
      }
    } catch (err: any) {
      console.error('Error checking answer visibility:', err)
      // Fallback to old logic if there's an error
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('show_correct_answers')
        .eq('id', user.id)
        .single()

      setShowCorrectAnswers(profileData?.show_correct_answers || false)
    }
  }

  const checkResultVisibility = async () => {
    if (!user || !attemptId) return

    try {
      // Get the test attempt to find the exam ID and check if it's practice mode
      const { data: attemptData, error: attemptError } = await supabase
        .from('test_attempts')
        .select('exam_id, is_practice_mode')
        .eq('id', attemptId)
        .eq('user_id', user.id)
        .single()

      if (attemptError) throw attemptError

      // For practice sessions, always allow results to be shown
      if (attemptData?.is_practice_mode) {
        setCanShowResults(true)
      } else if (attemptData?.exam_id) {
        const canShow = await ExamService.canShowResults(
          user.id,
          attemptData.exam_id
        )
        setCanShowResults(canShow)

        if (!canShow) {
          router.push(`/student/results/${attemptId}`)
          return
        }
      }
    } catch (err: any) {
      console.error('Error checking result visibility:', err)
      setCanShowResults(true)
    }
  }

  const loadReviewData = async () => {
    if (!user) return

    try {
      // Check if user has access to this attempt
      const { data: attemptCheck, error: accessError } = await supabase
        .from('test_attempts')
        .select('user_id, exam_id')
        .eq('id', attemptId)
        .eq('user_id', user.id)
        .single()

      if (accessError || !attemptCheck) {
        throw new Error('Access denied or attempt not found')
      }

      // Get the test attempt with exam information and answer visibility fields
      // For practice sessions, we use a left join since they might not have an exam_id
      const { data: attempt, error: attemptError } = await supabase
        .from('test_attempts')
        .select(
          `
          *,
          exams(*)
        `
        )
        .eq('id', attemptId)
        .single()

      if (attemptError || !attempt) {
        throw new Error('Failed to load attempt data')
      }

      console.log('🔍 Test attempt data:', attempt)
      console.log('🔍 Exam ID from attempt:', attempt.exam_id)
      console.log('🔍 Is practice mode:', attempt.is_practice_mode)

      let allQuestions: QuestionWithMetadata[] = []
      
      // Handle practice sessions differently
      if (attempt.is_practice_mode) {
        console.log('🔍 Loading questions for practice session')
        // For practice sessions, get questions from user_answers
        const { data: practiceAnswers, error: answersError } = await supabase
          .from('user_answers')
          .select(`
            *,
            questions(*)
          `)
          .eq('attempt_id', attemptId)
          .order('question_id')

        if (answersError) {
          throw new Error('Failed to load practice session answers')
        }

        allQuestions = practiceAnswers
          ?.filter(ua => ua.questions)
          .map((ua, index) => ({
            ...(ua.questions as unknown as Question),
            _exam_question_number: index + 1,
            _module_type: 'practice'
          })) || []
          
        console.log('🔍 Practice mode loaded questions:', allQuestions.length)
        
        // For practice mode, we already have user answers, so we'll use them directly
        const reviewData: ReviewData = {
          attempt,
          exam: { 
            id: 'practice-session', 
            title: 'Practice Session',
            module_composition: {},
            time_limits: {},
            template_id: null
          },
          questions: allQuestions,
          userAnswers: practiceAnswers || [],
        }

        setReviewData(reviewData)
        return // Early return for practice sessions
      } else {
        // Handle regular exam sessions
        // Smart detection: Determine which system this exam uses
        const examSystem = attempt.exams?.template_id ? 'template' : 'direct'
        console.log('🔍 Exam system detected:', examSystem)
        console.log('🔍 Template ID:', attempt.exams?.template_id)
        console.log('🔍 Module composition:', attempt.exams?.module_composition)
      
      if (examSystem === 'template') {
        // NEW SYSTEM: Template-based exam using exam_questions table
        console.log('🔍 Loading questions via exam_questions table')
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
          console.error('🚨 exam_questions query error:', examQuestionsError)
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
          
          console.log('🔍 Template system loaded questions:', allQuestions.length)
          console.log('🔍 Questions sample:', allQuestions.slice(0, 2).map(q => ({ 
            id: q.id, 
            question_number: q._exam_question_number, 
            module: q._module_type,
            original_exam_id: q.exam_id 
          })))
        }
      } else {
        // OLD SYSTEM: Direct exam_id connection in questions table
        console.log('🔍 Loading questions via direct exam_id connection')
        const { data: questions, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('exam_id', attempt.exam_id)
          .order('question_number')
        
        if (questionsError) {
          console.error('🚨 Direct questions query error:', questionsError)
          throw new Error(`Failed to load questions directly: ${questionsError.message}`)
        }
        
        allQuestions = questions || []
        console.log('🔍 Direct system loaded questions:', allQuestions.length)
        console.log('🔍 Questions sample:', allQuestions.slice(0, 2).map(q => ({ 
          id: q.id, 
          question_number: q.question_number, 
          exam_id: q.exam_id 
        })))
        }
      }

      console.log('🔍 Total questions loaded:', allQuestions.length)

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
        exam: attempt.exams || { 
          id: 'practice-session', 
          title: 'Practice Session',
          module_composition: {},
          time_limits: {},
          template_id: null
        },
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

  if (!canShowResults) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-orange-500 text-2xl">🔒</span>
            </div>
            <h3 className="text-lg font-medium text-orange-900 mb-2">
              Results Currently Hidden
            </h3>
            <p className="text-orange-700 mb-4">
              Your instructor has chosen to hide exam results for now. Results
              will be available when they are released.
            </p>
            <Link
              href="/student/results"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Results
            </Link>
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
              href={`/student/results/${attemptId}`}
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Results
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ReviewPageClient
      reviewData={reviewData}
      showCorrectAnswers={showCorrectAnswers}
      attemptId={attemptId}
    />
  )
}
