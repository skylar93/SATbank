'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { QuestionFilter } from '@/components/problem-bank/question-filter'
import type { MistakeWithQuestion } from '@/lib/types'
import { isEmptyHtml } from '@/lib/content-converter'

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

export function MistakeNotebookClient({
  mistakes,
}: MistakeNotebookClientProps) {
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
    mistakes.forEach((mistake) => {
      if (mistake.questions?.topic_tags) {
        mistake.questions.topic_tags.forEach((tag: string) => topics.add(tag))
      }
    })
    return Array.from(topics).sort()
  }, [mistakes])

  // Filter mistakes based on current filters
  const filteredMistakes = useMemo(() => {
    return mistakes.filter((mistake) => {
      const question = mistake.questions
      if (!question) return false

      // Module filter
      if (filters.module !== 'all' && question.module_type !== filters.module) {
        return false
      }

      // Difficulty filter
      if (
        filters.difficulty !== 'all' &&
        question.difficulty_level !== filters.difficulty
      ) {
        return false
      }

      // Question type filter
      if (
        filters.questionType !== 'all' &&
        question.question_type !== filters.questionType
      ) {
        return false
      }

      // Topics filter
      if (filters.topics.length > 0) {
        const questionTopics = question.topic_tags || []
        const hasMatchingTopic = filters.topics.some((topic) =>
          questionTopics.includes(topic)
        )
        if (!hasMatchingTopic) return false
      }

      // Status filter (for mistake notebook, we might want to filter by mastered/unmastered)
      // For now, we'll show all mistakes regardless of the showIncorrectOnly flag

      return true
    })
  }, [mistakes, filters])

  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }

  const handleMistakeToggle = (mistakeId: string) => {
    setSelectedMistakes((prev) =>
      prev.includes(mistakeId)
        ? prev.filter((id) => id !== mistakeId)
        : [...prev, mistakeId]
    )
  }

  const handleSelectAll = () => {
    if (selectedMistakes.length === filteredMistakes.length) {
      setSelectedMistakes([])
    } else {
      setSelectedMistakes(filteredMistakes.map((mistake) => mistake.id))
    }
  }

  const handleCreatePracticeQuiz = () => {
    if (selectedMistakes.length === 0) return

    const selectedQuestionIds = mistakes
      .filter((mistake) => selectedMistakes.includes(mistake.id))
      .map((mistake) => mistake.question_id)

    const queryParams = new URLSearchParams()
    selectedQuestionIds.forEach((id) => queryParams.append('q', id))
    router.push(`/student/practice-quiz?${queryParams.toString()}`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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
                {filteredMistakes.length} Mistake
                {filteredMistakes.length !== 1 ? 's' : ''} Found
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
                {selectedMistakes.length === filteredMistakes.length
                  ? 'Deselect All'
                  : 'Select All'}
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
              {mistakes.length === 0
                ? 'No mistakes yet!'
                : 'No mistakes match your filters'}
            </h3>
            <p className="text-gray-600">
              {mistakes.length === 0
                ? 'Take an exam to start building your mistake notebook.'
                : 'Try adjusting your filters to see more results.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMistakes.map((mistake) => {
              const question = mistake.questions
              if (!question) return null

              return (
                <div
                  key={mistake.id}
                  className="group bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all duration-200 hover:-translate-y-1"
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500 text-white">
                          Question {question.question_number || 'N/A'}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {question.module_type.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedMistakes.includes(mistake.id)}
                        onChange={() => handleMistakeToggle(mistake.id)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>

                    {/* Status and Difficulty */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            question.difficulty_level === 'hard'
                              ? 'bg-red-100 text-red-700'
                              : question.difficulty_level === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {question.difficulty_level}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          {question.question_type.replace('_', ' ')}
                        </span>
                      </div>
                      {getStatusBadge(mistake.status)}
                    </div>
                  </div>

                  {/* Card Content - Question Preview */}
                  <div className="p-4">
                    <div className="mb-4">
                      <p className="text-sm text-gray-800 leading-relaxed line-clamp-4">
                        {(() => {
                          // HTML-first rendering for question preview
                          let content = ''
                          if (
                            question.question_html &&
                            !isEmptyHtml(question.question_html)
                          ) {
                            content = question.question_html
                            // For preview, show plain text to avoid HTML complexity
                            const cleanText = content
                              .replace(/<[^>]*>/g, ' ')
                              .replace(/\s+/g, ' ')
                              .trim()
                            return cleanText.length > 120
                              ? `${cleanText.substring(0, 120)}...`
                              : cleanText
                          } else {
                            content =
                              question.question_text || 'No preview available'
                            return content.length > 120
                              ? `${content.substring(0, 120)}...`
                              : content
                          }
                        })()}
                      </p>
                    </div>

                    {/* Topic Tags */}
                    {question.topic_tags && question.topic_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {question.topic_tags.slice(0, 3).map((tag: string) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-200"
                          >
                            #{tag}
                          </span>
                        ))}
                        {question.topic_tags.length > 3 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-50 text-gray-600">
                            +{question.topic_tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 rounded-b-xl">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center">
                          <svg
                            className="w-3 h-3 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {formatDate(mistake.first_mistaken_at)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="flex items-center font-medium text-blue-600">
                          <svg
                            className="w-3 h-3 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {question.points} pt{question.points !== 1 ? 's' : ''}
                        </span>
                        <button
                          className="text-blue-600 hover:text-blue-800 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() =>
                            router.push(`/student/problem-bank/${question.id}`)
                          }
                        >
                          Review →
                        </button>
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
