'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../../contexts/auth-context'
import { QuestionFilter } from '../../../../components/problem-bank/question-filter'
import { QuestionList } from '../../../../components/problem-bank/question-list'
import { PracticeQuizGenerator } from '../../../../components/problem-bank/practice-quiz-generator'
import { IncorrectAnswersSection } from '../../../../components/problem-bank/incorrect-answers-section'
import { supabase } from '../../../../lib/supabase'
import { StatsCard } from '../../../../components/modern-charts'
import {
  BookOpenIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  AcademicCapIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

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
  exam_title?: string | null
  exam_id?: string | null
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
  const router = useRouter()

  // Redirect to mistake notebook temporarily
  useEffect(() => {
    router.push('/student/mistake-notebook')
  }, [router])

  // Use the centralized Supabase client
  const [questions, setQuestions] = useState<Question[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([])
  const [filters, setFilters] = useState<FilterOptions>({
    module: 'all',
    difficulty: 'all',
    questionType: 'all',
    topics: [],
    showIncorrectOnly: false,
  })
  const [loading, setLoading] = useState(true)
  const [availableTopics, setAvailableTopics] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<
    'browse' | 'practice' | 'incorrect'
  >('browse')
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    // Fetch questions if we have a user with ID, regardless of loading state
    if (user && user.id && !hasFetchedRef.current) {
      console.log('🔄 ProblemBank: Fetching questions for user:', user.email)
      console.log('🔄 ProblemBank: User object:', user)
      console.log('🔄 ProblemBank: Loading state:', loading)
      hasFetchedRef.current = true
      fetchQuestions()
    }
  }, [user?.id]) // Only depend on user ID

  useEffect(() => {
    applyFilters()
  }, [questions, filters])

  const fetchQuestions = async () => {
    try {
      setLoading(true)
      console.log('🔄 fetchQuestions: Starting...')

      // Check if Supabase client is initialized
      if (!supabase) {
        console.error(
          'Supabase client is not initialized. Please check your environment variables.'
        )
        setLoading(false)
        return
      }

      // Debug: Check auth state and session
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      console.log('🔄 fetchQuestions: Auth user:', authUser)
      console.log('🔄 fetchQuestions: Auth error:', authError)
      console.log('🔄 fetchQuestions: Session exists:', !!session)
      console.log('🔄 fetchQuestions: Session error:', sessionError)

      if (!authUser || !session) {
        console.log('❌ fetchQuestions: No authenticated user or session found')
        setLoading(false)
        return
      }

      // First, fetch all questions with exam information
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select(
          `
          *,
          exams!questions_exam_id_fkey (
            id,
            title
          )
        `
        )
        .order('module_type')
        .order('question_number')

      if (questionsError) {
        console.error('Error fetching questions:', questionsError)
        console.error('Error details:', {
          code: questionsError.code,
          message: questionsError.message,
          hint: questionsError.hint,
          details: questionsError.details,
        })

        // If it's a permissions error, try to fetch with minimal select
        if (
          questionsError.code === '42501' ||
          questionsError.message?.includes('permission')
        ) {
          console.log('Trying fallback query with minimal permissions...')
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('questions')
            .select(
              'id, module_type, question_number, question_type, difficulty_level, question_text, options, correct_answer, explanation, topic_tags'
            )
            .limit(5)

          if (fallbackError) {
            console.error('Fallback query also failed:', fallbackError)
          } else {
            console.log(
              'Fallback query succeeded with',
              fallbackData?.length,
              'questions'
            )
          }
        }

        throw questionsError
      }

      if (!questionsData || questionsData.length === 0) {
        console.log('No questions found in database')
        console.log('Current user:', user)
        console.log('Auth user:', authUser)
        console.log('Questions data:', questionsData)
        setQuestions([])
        setAvailableTopics([])
        setLoading(false)
        return
      }

      // Separately fetch user's incorrect answers
      const { data: incorrectAnswers, error: answersError } = await supabase
        .from('user_answers')
        .select(
          `
          question_id,
          is_correct,
          test_attempts!inner (
            user_id
          )
        `
        )
        .eq('test_attempts.user_id', user?.id)
        .eq('is_correct', false)

      if (answersError) {
        console.error('Error fetching user answers:', answersError)
        // Continue without incorrect answer data
      }

      // Create a set of question IDs that were answered incorrectly
      const incorrectQuestionIds = new Set(
        incorrectAnswers?.map((answer) => answer.question_id) || []
      )

      // Process questions to mark incorrect ones and include exam information
      const processedQuestions = questionsData.map((q) => ({
        ...q,
        is_incorrect: incorrectQuestionIds.has(q.id),
        exam_title: q.exams?.title || null,
        exam_id: q.exams?.id || q.exam_id || null,
      }))

      setQuestions(processedQuestions)

      // Extract unique topics
      const topics = new Set<string>()
      processedQuestions.forEach((q) => {
        q.topic_tags?.forEach((tag: string) => topics.add(tag))
      })
      setAvailableTopics(Array.from(topics).sort())

      console.log(
        `Loaded ${processedQuestions.length} questions with ${topics.size} unique topics`
      )
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
      filtered = filtered.filter((q) => q.module_type === filters.module)
    }

    // Difficulty filter
    if (filters.difficulty !== 'all') {
      filtered = filtered.filter(
        (q) => q.difficulty_level === filters.difficulty
      )
    }

    // Question type filter
    if (filters.questionType !== 'all') {
      filtered = filtered.filter(
        (q) => q.question_type === filters.questionType
      )
    }

    // Topics filter
    if (filters.topics.length > 0) {
      filtered = filtered.filter((q) =>
        filters.topics.some((topic) => q.topic_tags?.includes(topic))
      )
    }

    // Show incorrect only filter
    if (filters.showIncorrectOnly) {
      filtered = filtered.filter((q) => q.is_incorrect)
    }

    setFilteredQuestions(filtered)
  }

  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }

  if (!user) return null

  const incorrectQuestions = questions.filter((q) => q.is_incorrect)

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Problem Bank</h1>
            <p className="text-gray-600">
              Practice with targeted questions and track your progress
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user.profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatsCard
            title="Total Questions"
            value={questions.length}
            change="+2.5%"
            changeType="positive"
            miniChart={{
              data: [120, 135, 150, 160, 175, Math.max(questions.length, 175)],
              color: '#10b981',
            }}
          />

          <StatsCard
            title="Filtered Questions"
            value={filteredQuestions.length}
            change="+0.8%"
            changeType="positive"
            miniChart={{
              data: [
                50,
                60,
                70,
                80,
                85,
                Math.max(filteredQuestions.length, 50),
              ],
              color: '#8b5cf6',
            }}
          />

          <StatsCard
            title="Incorrect Answers"
            value={incorrectQuestions.length}
            change="-12%"
            changeType="negative"
            miniChart={{
              data: [
                25,
                20,
                18,
                15,
                12,
                Math.max(incorrectQuestions.length, 0),
              ],
              color: '#ef4444',
            }}
          />
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
            <div className="flex space-x-2">
              {[
                {
                  id: 'browse',
                  label: 'Browse Questions',
                  icon: BookOpenIcon,
                  count: filteredQuestions.length,
                },
                {
                  id: 'practice',
                  label: 'Practice Quiz',
                  icon: AcademicCapIcon,
                },
                {
                  id: 'incorrect',
                  label: 'Incorrect Answers',
                  icon: ExclamationTriangleIcon,
                  count: incorrectQuestions.length,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 flex-1 justify-center ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        activeTab === tab.id
                          ? 'bg-white bg-opacity-20 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'browse' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center space-x-2 mb-4">
                  <AdjustmentsHorizontalIcon className="w-5 h-5 text-violet-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Filters
                  </h3>
                </div>
                <QuestionFilter
                  filters={filters}
                  availableTopics={availableTopics}
                  onFilterChange={handleFilterChange}
                />
              </div>
            </div>

            {/* Questions */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Questions
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {filteredQuestions.length} of {questions.length}{' '}
                        questions
                      </span>
                      <button
                        onClick={() => {
                          console.log('🔄 Manual refresh clicked')
                          hasFetchedRef.current = false
                          fetchQuestions()
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Refresh questions"
                      >
                        <ChartBarIcon className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <QuestionList
                    questions={filteredQuestions}
                    loading={loading}
                    onRefresh={fetchQuestions}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'practice' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center space-x-2 mb-6">
              <AcademicCapIcon className="w-6 h-6 text-violet-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Practice Quiz Generator
              </h3>
            </div>
            <PracticeQuizGenerator
              questions={questions}
              availableTopics={availableTopics}
            />
          </div>
        )}

        {activeTab === 'incorrect' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex items-center space-x-2 mb-6">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Incorrect Answers Review
              </h3>
            </div>
            <IncorrectAnswersSection
              questions={incorrectQuestions}
              onRefresh={fetchQuestions}
            />
          </div>
        )}
      </div>
    </div>
  )
}
