'use client'

import { useState } from 'react'

interface FilterOptions {
  module: string
  difficulty: string
  questionType: string
  topics: string[]
  showIncorrectOnly: boolean
}

interface QuestionFilterProps {
  filters: FilterOptions
  availableTopics: string[]
  onFilterChange: (filters: Partial<FilterOptions>) => void
}

export function QuestionFilter({
  filters,
  availableTopics,
  onFilterChange,
}: QuestionFilterProps) {
  const [expandedSections, setExpandedSections] = useState({
    module: true,
    difficulty: true,
    type: true,
    topics: false,
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const handleTopicToggle = (topic: string) => {
    const newTopics = filters.topics.includes(topic)
      ? filters.topics.filter((t) => t !== topic)
      : [...filters.topics, topic]

    onFilterChange({ topics: newTopics })
  }

  const clearAllFilters = () => {
    onFilterChange({
      module: 'all',
      difficulty: 'all',
      questionType: 'all',
      topics: [],
      showIncorrectOnly: false,
    })
  }

  const hasActiveFilters =
    filters.module !== 'all' ||
    filters.difficulty !== 'all' ||
    filters.questionType !== 'all' ||
    filters.topics.length > 0 ||
    filters.showIncorrectOnly

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Incorrect Answers Only */}
      <div className="mb-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={filters.showIncorrectOnly}
            onChange={(e) =>
              onFilterChange({ showIncorrectOnly: e.target.checked })
            }
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">
            Show incorrect answers only
          </span>
        </label>
      </div>

      {/* Module Filter */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('module')}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="font-medium text-gray-900">Module</h4>
          <span className="text-gray-400">
            {expandedSections.module ? '−' : '+'}
          </span>
        </button>

        {expandedSections.module && (
          <div className="mt-2 space-y-2">
            {[
              { value: 'all', label: 'All Modules' },
              { value: 'english1', label: 'English 1' },
              { value: 'english2', label: 'English 2' },
              { value: 'math1', label: 'Math 1' },
              { value: 'math2', label: 'Math 2' },
            ].map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  name="module"
                  value={option.value}
                  checked={filters.module === option.value}
                  onChange={(e) => onFilterChange({ module: e.target.value })}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Difficulty Filter */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('difficulty')}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="font-medium text-gray-900">Difficulty</h4>
          <span className="text-gray-400">
            {expandedSections.difficulty ? '−' : '+'}
          </span>
        </button>

        {expandedSections.difficulty && (
          <div className="mt-2 space-y-2">
            {[
              { value: 'all', label: 'All Levels' },
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ].map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  name="difficulty"
                  value={option.value}
                  checked={filters.difficulty === option.value}
                  onChange={(e) =>
                    onFilterChange({ difficulty: e.target.value })
                  }
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Question Type Filter */}
      <div className="mb-6">
        <button
          onClick={() => toggleSection('type')}
          className="flex items-center justify-between w-full text-left"
        >
          <h4 className="font-medium text-gray-900">Question Type</h4>
          <span className="text-gray-400">
            {expandedSections.type ? '−' : '+'}
          </span>
        </button>

        {expandedSections.type && (
          <div className="mt-2 space-y-2">
            {[
              { value: 'all', label: 'All Types' },
              { value: 'multiple_choice', label: 'Multiple Choice' },
              { value: 'grid_in', label: 'Grid-in' },
              { value: 'essay', label: 'Essay' },
            ].map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="radio"
                  name="questionType"
                  value={option.value}
                  checked={filters.questionType === option.value}
                  onChange={(e) =>
                    onFilterChange({ questionType: e.target.value })
                  }
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Topics Filter */}
      {availableTopics.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('topics')}
            className="flex items-center justify-between w-full text-left"
          >
            <h4 className="font-medium text-gray-900">
              Topics {filters.topics.length > 0 && `(${filters.topics.length})`}
            </h4>
            <span className="text-gray-400">
              {expandedSections.topics ? '−' : '+'}
            </span>
          </button>

          {expandedSections.topics && (
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {availableTopics.map((topic) => (
                <label key={topic} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.topics.includes(topic)}
                    onChange={() => handleTopicToggle(topic)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{topic}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="pt-4 border-t border-gray-200">
          <h5 className="text-sm font-medium text-gray-900 mb-2">
            Active Filters:
          </h5>
          <div className="space-y-1">
            {filters.module !== 'all' && (
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                Module: {filters.module}
              </span>
            )}
            {filters.difficulty !== 'all' && (
              <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded ml-1">
                Difficulty: {filters.difficulty}
              </span>
            )}
            {filters.questionType !== 'all' && (
              <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded ml-1">
                Type: {filters.questionType}
              </span>
            )}
            {filters.showIncorrectOnly && (
              <span className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded ml-1">
                Incorrect Only
              </span>
            )}
            {filters.topics.map((topic) => (
              <span
                key={topic}
                className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded ml-1"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
