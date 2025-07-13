'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/auth-context'
import { Navigation } from '../../../components/navigation'
import { QuestionFilter } from '../../../components/problem-bank/question-filter'
import { QuestionList } from '../../../components/problem-bank/question-list'
import { PracticeQuizGenerator } from '../../../components/problem-bank/practice-quiz-generator'
import { IncorrectAnswersSection } from '../../../components/problem-bank/incorrect-answers-section'
import { createClient } from '../../../lib/supabase'

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
}

interface FilterOptions {
  module: string
  difficulty: string
  questionType: string
  topics: string[]
  showIncorrectOnly: boolean
}

export default function ProblemBank() {
  const { user } = useAuth()
  const supabase = createClient()
  const [questions, setQuestions] = useState<Question[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([])
  const [filters, setFilters] = useState<FilterOptions>({
    module: 'all',
    difficulty: 'all',
    questionType: 'all',
    topics: [],
    showIncorrectOnly: false
  })
  const [loading, setLoading] = useState(true)
  const [availableTopics, setAvailableTopics] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'browse' | 'practice' | 'incorrect'>('browse')

  useEffect(() => {
    if (user) {
      fetchQuestions()
    }
  }, [user])

  useEffect(() => {
    applyFilters()
  }, [questions, filters])

  const fetchQuestions = async () => {
    try {
      setLoading(true)
      
      // Check if Supabase client is initialized
      if (!supabase) {
        console.error('Supabase client is not initialized. Please check your environment variables.')
        setLoading(false)
        return
      }
      
      // First, fetch all questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .order('module_type')
        .order('question_number')

      if (questionsError) {
        console.error('Error fetching questions:', questionsError)
        throw questionsError
      }

      if (!questionsData || questionsData.length === 0) {
        console.log('No questions found in database')
        console.log('Current user:', user)
        console.log('Questions data:', questionsData)
        setQuestions([])
        setAvailableTopics([])
        setLoading(false)
        return
      }

      // Separately fetch user's incorrect answers
      const { data: incorrectAnswers, error: answersError } = await supabase
        .from('user_answers')
        .select(`
          question_id,
          is_correct,
          test_attempts!inner (
            user_id
          )
        `)
        .eq('test_attempts.user_id', user?.id)
        .eq('is_correct', false)

      if (answersError) {
        console.error('Error fetching user answers:', answersError)
        // Continue without incorrect answer data
      }

      // Create a set of question IDs that were answered incorrectly
      const incorrectQuestionIds = new Set(
        incorrectAnswers?.map(answer => answer.question_id) || []
      )

      // Process questions to mark incorrect ones
      const processedQuestions = questionsData.map(q => ({
        ...q,
        is_incorrect: incorrectQuestionIds.has(q.id)
      }))

      setQuestions(processedQuestions)

      // Extract unique topics
      const topics = new Set<string>()
      processedQuestions.forEach(q => {
        q.topic_tags?.forEach((tag: string) => topics.add(tag))
      })
      setAvailableTopics(Array.from(topics).sort())

      console.log(`Loaded ${processedQuestions.length} questions with ${topics.size} unique topics`)

    } catch (error) {
      console.error('Error fetching questions:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...questions]

    // Module filter
    if (filters.module !== 'all') {
      filtered = filtered.filter(q => q.module_type === filters.module)
    }

    // Difficulty filter
    if (filters.difficulty !== 'all') {
      filtered = filtered.filter(q => q.difficulty_level === filters.difficulty)
    }

    // Question type filter
    if (filters.questionType !== 'all') {
      filtered = filtered.filter(q => q.question_type === filters.questionType)
    }

    // Topics filter
    if (filters.topics.length > 0) {
      filtered = filtered.filter(q => 
        filters.topics.some(topic => q.topic_tags?.includes(topic))
      )
    }

    // Show incorrect only filter
    if (filters.showIncorrectOnly) {
      filtered = filtered.filter(q => q.is_incorrect)
    }

    setFilteredQuestions(filtered)
  }

  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  if (!user) return null

  const incorrectQuestions = questions.filter(q => q.is_incorrect)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Problem Bank</h1>
            <p className="mt-2 text-gray-600">
              Practice with targeted questions and track your progress
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('browse')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'browse'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Browse Questions ({filteredQuestions.length})
              </button>
              <button
                onClick={() => setActiveTab('practice')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'practice'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Practice Quiz
              </button>
              <button
                onClick={() => setActiveTab('incorrect')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'incorrect'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Incorrect Answers ({incorrectQuestions.length})
              </button>
            </nav>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'browse' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Filters */}
              <div className="lg:col-span-1">
                <QuestionFilter
                  filters={filters}
                  availableTopics={availableTopics}
                  onFilterChange={handleFilterChange}
                />
              </div>

              {/* Questions */}
              <div className="lg:col-span-3">
                <QuestionList
                  questions={filteredQuestions}
                  loading={loading}
                  onRefresh={fetchQuestions}
                />
              </div>
            </div>
          )}

          {activeTab === 'practice' && (
            <PracticeQuizGenerator
              questions={questions}
              availableTopics={availableTopics}
            />
          )}

          {activeTab === 'incorrect' && (
            <IncorrectAnswersSection
              questions={incorrectQuestions}
              onRefresh={fetchQuestions}
            />
          )}
        </div>
      </div>
    </div>
  )
}