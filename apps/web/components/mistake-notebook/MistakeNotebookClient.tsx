'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { QuestionFilter } from '@/components/problem-bank/question-filter'
import type { MistakeWithQuestion } from '@/lib/types'

interface FilterOptions {
  module: string
  difficulty: string
  questionType: string
  topics: string[]
  showIncorrectOnly: boolean
}

interface MistakeNotebookClientProps {
  mistakes: MistakeWithQuestion[]
}

export function MistakeNotebookClient({ mistakes }: MistakeNotebookClientProps) {
  const router = useRouter()
  
  const [filters, setFilters] = useState<FilterOptions>({
    module: 'all',
    difficulty: 'all',
    questionType: 'all',
    topics: [],
    showIncorrectOnly: false,
  })
  
  const [selectedMistakes, setSelectedMistakes] = useState<string[]>([])

  // Extract available topics from mistakes
  const availableTopics = useMemo(() => {
    const topics = new Set<string>()
    mistakes.forEach(mistake => {
      if (mistake.questions?.topic_tags) {
        mistake.questions.topic_tags.forEach((tag: string) => topics.add(tag))
      }
    })
    return Array.from(topics).sort()
  }, [mistakes])

  // Filter mistakes based on current filters
  const filteredMistakes = useMemo(() => {
    return mistakes.filter(mistake => {
      const question = mistake.questions
      if (!question) return false

      // Module filter
      if (filters.module !== 'all' && question.module_type !== filters.module) {
        return false
      }

      // Difficulty filter
      if (filters.difficulty !== 'all' && question.difficulty_level !== filters.difficulty) {
        return false
      }

      // Question type filter
      if (filters.questionType !== 'all' && question.question_type !== filters.questionType) {
        return false
      }

      // Topics filter
      if (filters.topics.length > 0) {
        const questionTopics = question.topic_tags || []
        const hasMatchingTopic = filters.topics.some(topic => questionTopics.includes(topic))
        if (!hasMatchingTopic) return false
      }

      // Status filter (for mistake notebook, we might want to filter by mastered/unmastered)
      // For now, we'll show all mistakes regardless of the showIncorrectOnly flag

      return true
    })
  }, [mistakes, filters])

  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const handleMistakeToggle = (mistakeId: string) => {
    setSelectedMistakes(prev => 
      prev.includes(mistakeId)
        ? prev.filter(id => id !== mistakeId)
        : [...prev, mistakeId]
    )
  }

  const handleSelectAll = () => {
    if (selectedMistakes.length === filteredMistakes.length) {
      setSelectedMistakes([])
    } else {
      setSelectedMistakes(filteredMistakes.map(mistake => mistake.id))
    }
  }

  const handleCreatePracticeQuiz = () => {
    if (selectedMistakes.length === 0) return

    const selectedQuestionIds = mistakes
      .filter(mistake => selectedMistakes.includes(mistake.id))
      .map(mistake => mistake.question_id)

    const queryParams = new URLSearchParams()
    selectedQuestionIds.forEach(id => queryParams.append('q', id))
    router.push(`/student/practice-quiz?${queryParams.toString()}`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: 'unmastered' | 'mastered') => {
    if (status === 'mastered') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Mastered
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Needs Practice
      </span>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Filters Sidebar */}
      <div className="lg:col-span-1">
        <QuestionFilter
          filters={filters}
          availableTopics={availableTopics}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Main Content */}
      <div className="lg:col-span-3">
        {/* Summary and Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {filteredMistakes.length} Mistake{filteredMistakes.length !== 1 ? 's' : ''} Found
              </h2>
              <p className="text-sm text-gray-600">
                {selectedMistakes.length} selected
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={filteredMistakes.length === 0}
              >
                {selectedMistakes.length === filteredMistakes.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={handleCreatePracticeQuiz}
                disabled={selectedMistakes.length === 0}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Create Practice Quiz ({selectedMistakes.length})
              </button>
            </div>
          </div>
        </div>

        {/* Mistakes List */}
        {filteredMistakes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-gray-400 text-lg mb-2">🎉</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {mistakes.length === 0 ? 'No mistakes yet!' : 'No mistakes match your filters'}
            </h3>
            <p className="text-gray-600">
              {mistakes.length === 0 
                ? 'Take an exam to start building your mistake notebook.'
                : 'Try adjusting your filters to see more results.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMistakes.map((mistake) => {
              const question = mistake.questions
              if (!question) return null

              return (
                <div key={mistake.id} className="bg-white rounded-lg shadow border border-gray-200">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedMistakes.includes(mistake.id)}
                          onChange={() => handleMistakeToggle(mistake.id)}
                          className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {question.module_type.toUpperCase()}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {question.difficulty_level}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {question.question_type.replace('_', ' ')}
                            </span>
                            {getStatusBadge(mistake.status)}
                          </div>
                          <div className="text-sm text-gray-900 mb-2">
                            {question.question_text.substring(0, 150)}
                            {question.question_text.length > 150 && '...'}
                          </div>
                          <div className="flex items-center text-xs text-gray-500 space-x-4">
                            <span>First mistake: {formatDate(mistake.first_mistaken_at)}</span>
                            {mistake.last_reviewed_at && (
                              <span>Last reviewed: {formatDate(mistake.last_reviewed_at)}</span>
                            )}
                            <span>Worth {question.points} point{question.points !== 1 ? 's' : ''}</span>
                          </div>
                          {question.topic_tags && question.topic_tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {question.topic_tags.map((tag: string) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}