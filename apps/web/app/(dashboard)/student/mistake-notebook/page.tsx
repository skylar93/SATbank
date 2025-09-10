'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../../../contexts/auth-context'
import { supabase } from '../../../../lib/supabase'
import { EnhancedIncorrectAnswersSection } from '../../../../components/mistake-notebook/enhanced-incorrect-answers-section'

interface Question {
  id: string
  module_type: string
  question_number: number
  question_type: string
  difficulty_level: string
  question_text: string
  question_html?: string | null
  options: any
  options_html?: any
  correct_answer: string
  explanation: string
  explanation_html?: string | null
  topic_tags: string[]
  mistakeId?: string
  masteryStatus?: 'unmastered' | 'mastered'
  firstMistakenAt?: string
  lastReviewedAt?: string
  incorrectAttempts?: Array<{
    id: string
    user_answer: string
    answered_at: string
    attempt_id: string
  }>
}

export default function MistakeNotebookPage() {
  const { user } = useAuth()
  // Use the centralized Supabase client
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchIncorrectQuestions()
    }
  }, [user])

  const fetchIncorrectQuestions = async () => {
    try {
      setLoading(true)

      // Fetch mistakes from mistake_bank with question details and recent incorrect answers
      const { data: mistakeData, error: mistakeError } = await supabase
        .from('mistake_bank')
        .select(
          `
          id,
          question_id,
          status,
          first_mistaken_at,
          last_reviewed_at,
          questions (
            id,
            module_type,
            question_number,
            question_type,
            difficulty_level,
            question_text,
            question_html,
            options,
            options_html,
            correct_answer,
            explanation,
            explanation_html,
            topic_tags
          )
        `
        )
        .eq('user_id', user?.id)
        .order('first_mistaken_at', { ascending: false })

      if (mistakeError) throw mistakeError

      // For each mistake, get recent incorrect attempts
      const questionsWithAttempts = await Promise.all(
        mistakeData?.map(async (mistake) => {
          // Get recent incorrect answers for this question
          const { data: incorrectAnswers, error: answersError } = await supabase
            .from('user_answers')
            .select(
              `
              id,
              user_answer,
              answered_at,
              attempt_id,
              test_attempts!inner (
                user_id
              )
            `
            )
            .eq('test_attempts.user_id', user?.id)
            .eq('question_id', mistake.question_id)
            .eq('is_correct', false)
            .order('answered_at', { ascending: false })
            .limit(5) // Get last 5 incorrect attempts

          const incorrectAttempts =
            incorrectAnswers?.map((answer) => ({
              id: answer.id,
              user_answer: answer.user_answer,
              answered_at: answer.answered_at,
              attempt_id: answer.attempt_id,
            })) || []

          const question = mistake.questions as any
          return {
            id: question.id,
            module_type: question.module_type,
            question_number: question.question_number,
            question_type: question.question_type,
            difficulty_level: question.difficulty_level,
            question_text: question.question_text,
            options: question.options,
            correct_answer: question.correct_answer,
            explanation: question.explanation,
            topic_tags: question.topic_tags,
            mistakeId: mistake.id,
            masteryStatus: mistake.status,
            firstMistakenAt: mistake.first_mistaken_at,
            lastReviewedAt: mistake.last_reviewed_at,
            incorrectAttempts,
          }
        }) || []
      )

      setQuestions(questionsWithAttempts)
    } catch (error) {
      console.error('Error fetching incorrect questions:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Mistake Notebook
              </h1>
              <p className="text-gray-600">
                Review your incorrectly answered questions and create custom
                practice quizzes
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-violet-500 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl">📝</span>
            </div>
          </div>

          {/* Separator line */}
          <div className="border-b border-gray-200 pb-6 mb-8">
            <div className="text-sm text-gray-500">
              Track your progress and master your mistakes
            </div>
          </div>
        </div>

        <EnhancedIncorrectAnswersSection
          questions={questions}
          loading={loading}
          onRefresh={fetchIncorrectQuestions}
        />
      </div>
    </div>
  )
}
