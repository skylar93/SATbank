'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/auth-context'
import { QuestionFilter } from '../../../components/problem-bank/question-filter'
import { QuestionList } from '../../../components/problem-bank/question-list'
import { PracticeQuizGenerator } from '../../../components/problem-bank/practice-quiz-generator'
import { IncorrectAnswersSection } from '../../../components/problem-bank/incorrect-answers-section'
import { createClient } from '../../../lib/supabase'
import { StatsCard } from '../../../components/modern-charts'
import { 
  BookOpenIcon, 
  QuestionMarkCircleIcon, 
  ExclamationTriangleIcon,
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  AcademicCapIcon,
  ClockIcon
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
    <div className="h-full bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Problem Bank</h1>
            <p className="text-gray-600">Practice with targeted questions and track your progress</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search questions..."
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
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
              data: [120, 135, 150, 160, 175, questions.length],
              color: '#10b981'
            }}
          />
          
          <StatsCard
            title="Filtered Questions"
            value={filteredQuestions.length}
            change="+0.8%"
            changeType="positive"
            miniChart={{
              data: [50, 60, 70, 80, 85, filteredQuestions.length],
              color: '#8b5cf6'
            }}
          />
          
          <StatsCard
            title="Incorrect Answers"
            value={incorrectQuestions.length}
            change="-12%"
            changeType="negative"
            miniChart={{
              data: [25, 20, 18, 15, 12, incorrectQuestions.length],
              color: '#ef4444'
            }}
          />
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
            <div className="flex space-x-2">
              {[
                { id: 'browse', label: 'Browse Questions', icon: BookOpenIcon, count: filteredQuestions.length },
                { id: 'practice', label: 'Practice Quiz', icon: AcademicCapIcon },
                { id: 'incorrect', label: 'Incorrect Answers', icon: ExclamationTriangleIcon, count: incorrectQuestions.length }
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
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      activeTab === tab.id
                        ? 'bg-white bg-opacity-20 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
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
                  <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
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
                    <h3 className="text-lg font-semibold text-gray-900">Questions</h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {filteredQuestions.length} of {questions.length} questions
                      </span>
                      <button 
                        onClick={fetchQuestions}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
              <h3 className="text-lg font-semibold text-gray-900">Practice Quiz Generator</h3>
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
              <h3 className="text-lg font-semibold text-gray-900">Incorrect Answers Review</h3>
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