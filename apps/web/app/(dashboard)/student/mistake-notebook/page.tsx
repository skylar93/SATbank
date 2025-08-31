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
  options: any
  correct_answer: string
  explanation: string
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
            options,
            correct_answer,
            explanation,
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
    <div className="h-full bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Mistake Notebook
            </h1>
            <p className="text-gray-600">
              Review your incorrectly answered questions and create custom
              practice quizzes
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-lg">📝</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <EnhancedIncorrectAnswersSection
          questions={questions}
          loading={loading}
          onRefresh={fetchIncorrectQuestions}
        />
      </div>
    </div>
  )
}
