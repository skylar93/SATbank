'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { ExamService } from '@/lib/exam-service'
import { supabase } from '@/lib/supabase'

interface QuestionReview {
  id: string
  question_number: number
  module_type: string
  question_text: string
  question_html?: string
  question_image_url?: string
  options?: Record<string, string>
  options_html?: Record<string, string>
  correct_answer: string
  correct_answers?: string[]
  explanation?: string
  explanation_html?: string
  topic_tags?: string[]
  originalAnswer: string
  wasOriginallyCorrect: boolean
}

interface AttemptInfo {
  id: string
  exam_id: string
  total_score: number
  completed_at: string
  exam_title: string
}

export default function SecondChanceReviewPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [questions, setQuestions] = useState<QuestionReview[]>([])
  const [attemptInfo, setAttemptInfo] = useState<AttemptInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const attemptId = params.attemptId as string

  useEffect(() => {
    if (user && attemptId) {
      loadReviewData()
    }
  }, [user, attemptId])

  const loadReviewData = async () => {
    try {
      // Get original attempt info
      const { data: attempt, error: attemptError } = await supabase
        .from('test_attempts')
        .select(
          `
          id,
          exam_id,
          total_score,
          completed_at,
          review_attempt_taken,
          exams!inner (title)
        `
        )
        .eq('id', attemptId)
        .eq('user_id', user!.id)
        .single()

      if (attemptError) throw attemptError

      if (!attempt.review_attempt_taken) {
        throw new Error('Second chance has not been completed for this attempt')
      }

      setAttemptInfo({
        id: attempt.id,
        exam_id: attempt.exam_id,
        total_score: attempt.total_score,
        completed_at: attempt.completed_at,
        exam_title: (attempt.exams as any).title,
      })

      // Get all incorrect questions with original answers
      const { data: incorrectAnswers, error: answersError } = await supabase
        .from('user_answers')
        .select(
          `
          question_id,
          user_answer,
          is_correct,
          questions!inner (*)
        `
        )
        .eq('attempt_id', attemptId)
        .eq('is_correct', false)
        .order('questions.module_type')
        .order('questions.question_number')

      if (answersError) throw answersError

      const reviewQuestions: QuestionReview[] = incorrectAnswers.map(
        (answer: any) => ({
          ...answer.questions,
          originalAnswer: answer.user_answer,
          wasOriginallyCorrect: answer.is_correct,
        })
      )

      setQuestions(reviewQuestions)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getModuleDisplayName = (moduleType: string) => {
    const names: Record<string, string> = {
      english1: 'Reading and Writing',
      english2: 'Writing and Language',
      math1: 'Math (No Calculator)',
      math2: 'Math (Calculator)',
    }
    return names[moduleType] || moduleType
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading review results...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !attemptInfo) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-red-900 mb-2">
              Error Loading Review
            </h3>
            <p className="text-red-700 mb-4">{error || 'Review not found'}</p>
            <Link
              href="/student/results"
              className="inline-block bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Results
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Second Chance Review Complete! 🎉
              </h1>
              <p className="text-gray-600">
                You've now seen the correct answers and explanations for your
                mistakes
              </p>
            </div>
            <Link
              href={`/student/results/${attemptId}`}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              ← Back to Original Results
            </Link>
          </div>

          <div className="border-b border-gray-200 pb-6 mb-8">
            <div className="text-sm text-gray-500">
              Original Exam: {attemptInfo.exam_title}
              <br />
              Completed: {formatDate(attemptInfo.completed_at)}
            </div>
          </div>
        </div>

        {/* Success Banner */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl shadow-lg border border-amber-200 p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl">✨</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Great Learning Experience!
              </h3>
              <p className="text-gray-600 text-sm">
                You've completed your second chance review. The answers and
                explanations below will help you understand your mistakes.
                <br />
                <span className="text-amber-700 font-medium">
                  Note: This review does not affect your official score or
                  mistake bank.
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Questions Review */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-amber-100">
          <div className="p-6 border-b border-amber-200">
            <h3 className="text-lg font-semibold text-gray-900">
              📚 Complete Question Review ({questions.length} questions)
            </h3>
            <p className="text-gray-600 mt-1">
              Review each question with your original answer, correct answer,
              and detailed explanations
            </p>
          </div>

          <div className="p-6 space-y-6">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="border border-amber-200 rounded-xl p-6 bg-amber-50/30"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-white text-sm font-medium flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        Question {question.question_number} -{' '}
                        {getModuleDisplayName(question.module_type)}
                      </div>
                      {question.topic_tags &&
                        question.topic_tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {question.topic_tags.map((tag, tagIndex) => (
                              <span
                                key={tagIndex}
                                className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* Question Text */}
                <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">Question:</h4>
                  {question.question_html ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: question.question_html,
                      }}
                    />
                  ) : (
                    <p className="text-gray-800">{question.question_text}</p>
                  )}
                  {question.question_image_url && (
                    <img
                      src={question.question_image_url}
                      alt="Question image"
                      className="mt-3 max-w-full h-auto rounded"
                    />
                  )}
                </div>

                {/* Options (if multiple choice) */}
                {question.options && (
                  <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Answer Choices:
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(
                        question.options_html || question.options
                      ).map(([key, value]) => (
                        <div key={key} className="text-gray-700">
                          <strong>{key}.</strong>{' '}
                          {question.options_html ? (
                            <span dangerouslySetInnerHTML={{ __html: value }} />
                          ) : (
                            value
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Answer Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-medium text-red-800 mb-2">
                      Your Original Answer:
                    </h4>
                    <div className="text-red-700 font-medium">
                      {question.originalAnswer || 'No answer'}
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-800 mb-2">
                      Correct Answer:
                    </h4>
                    <div className="text-green-700 font-medium">
                      {Array.isArray(question.correct_answers)
                        ? question.correct_answers.join(', ')
                        : question.correct_answer}
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                {question.explanation && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-800 mb-2">
                      Explanation:
                    </h4>
                    {question.explanation_html ? (
                      <div
                        className="text-blue-700"
                        dangerouslySetInnerHTML={{
                          __html: question.explanation_html,
                        }}
                      />
                    ) : (
                      <p className="text-blue-700">{question.explanation}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-center space-x-4">
          <Link
            href={`/student/results/${attemptId}`}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200"
          >
            Back to Original Results
          </Link>
          <Link
            href="/student/exams"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Take Another Exam
          </Link>
        </div>
      </div>
    </div>
  )
}
