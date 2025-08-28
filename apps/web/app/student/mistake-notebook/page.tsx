'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/auth-context'
import { createClient } from '../../../lib/supabase'
import { EnhancedIncorrectAnswersSection } from '../../../components/mistake-notebook/enhanced-incorrect-answers-section'

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
  is_incorrect?: boolean
  incorrectAttempts?: Array<{
    id: string
    user_answer: string
    answered_at: string
    attempt_id: string
  }>
}

export default function MistakeNotebookPage() {
  const { user } = useAuth()
  const supabase = createClient()
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

      // Fetch all questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .order('module_type')
        .order('question_number')

      if (questionsError) throw questionsError

      // Fetch user's incorrect answers
      const { data: incorrectAnswers, error: answersError } = await supabase
        .from('user_answers')
        .select(`
          *,
          test_attempts!inner (
            user_id,
            created_at,
            is_practice_mode
          ),
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
        `)
        .eq('test_attempts.user_id', user?.id)
        .eq('is_correct', false)
        .order('answered_at', { ascending: false })

      if (answersError) throw answersError

      // Group answers by question
      const questionMap = new Map()
      incorrectAnswers?.forEach((answer) => {
        const questionId = answer.questions.id
        if (!questionMap.has(questionId)) {
          questionMap.set(questionId, {
            ...answer.questions,
            incorrectAttempts: [],
          })
        }
        questionMap.get(questionId).incorrectAttempts.push({
          id: answer.id,
          user_answer: answer.user_answer,
          answered_at: answer.answered_at,
          attempt_id: answer.attempt_id,
        })
      })

      const incorrectQuestions = Array.from(questionMap.values())
      setQuestions(incorrectQuestions)
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
            <h1 className="text-2xl font-bold text-gray-900">Mistake Notebook</h1>
            <p className="text-gray-600">
              Review your incorrectly answered questions and create custom practice quizzes
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