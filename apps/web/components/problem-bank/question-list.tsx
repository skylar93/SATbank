'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/auth-context'
import { supabase } from '../../lib/supabase'
import { renderHtmlContent } from '../exam/question-display'
import { isEmptyHtml } from '../../lib/content-converter'

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
  is_incorrect?: boolean
  exam_title?: string | null
  exam_id?: string | null
}

interface QuestionListProps {
  questions: Question[]
  loading: boolean
  onRefresh: () => void
}

export function QuestionList({
  questions,
  loading,
  onRefresh,
}: QuestionListProps) {
  const router = useRouter()
  const { user } = useAuth()
  // Use the centralized Supabase client
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)
  const [creatingPractice, setCreatingPractice] = useState<string | null>(null)

  const renderTable = (tableData: any, isAnswerChoice = false) => {
    const { headers, rows } = tableData
    return (
      <div className={`overflow-x-auto ${isAnswerChoice ? 'text-sm' : ''}`}>
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              {headers.map((header: string, index: number) => (
                <th
                  key={index}
                  className="border border-gray-300 px-2 py-1 text-left font-medium"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: string[], rowIndex: number) => (
              <tr
                key={rowIndex}
                className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                {row.map((cell: string, cellIndex: number) => (
                  <td
                    key={cellIndex}
                    className="border border-gray-300 px-2 py-1"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderOptionContent = (value: any) => {
    // If value is an object (table data), handle it specially
    if (typeof value === 'object' && value !== null) {
      // Check if it's direct table data format: {headers: [...], rows: [...]}
      if (value.headers && value.rows) {
        return renderTable(value, true)
      }

      // Check if it's nested table data format: {table_data: {headers: [...], rows: [...]}}
      if (
        value.table_data &&
        value.table_data.headers &&
        value.table_data.rows
      ) {
        return renderTable(value.table_data, true)
      }

      // If it's an object but not table data, try to display it meaningfully
      if (Array.isArray(value)) {
        return value.join(', ')
      }

      // For other objects, try to extract meaningful content
      if (value.content || value.text || value.value) {
        const textContent = value.content || value.text || value.value
        // Simple text rendering for extracted content
        return <span className="text-gray-900">{textContent}</span>
      }

      // If it has imageUrl and text properties (common option format)
      if (value.imageUrl || value.text) {
        return (
          <div className="space-y-1">
            {value.text && <div className="text-gray-900">{value.text}</div>}
            {value.imageUrl && (
              <img
                src={value.imageUrl}
                alt="Option image"
                className="max-w-full h-auto max-h-16 border border-gray-200 rounded"
              />
            )}
          </div>
        )
      }

      // As a last resort, show object keys or a descriptive message
      const keys = Object.keys(value)
      if (keys.length > 0) {
        return `[Complex content: ${keys.join(', ')}]`
      }

      return '[Empty object]'
    }

    // Try to parse as JSON to check if it's table data
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)

        // Check for table data formats
        if (
          parsed.table_data &&
          parsed.table_data.headers &&
          parsed.table_data.rows
        ) {
          return renderTable(parsed.table_data, true)
        }
        if (parsed.headers && parsed.rows) {
          return renderTable(parsed, true)
        }

        // Check for option format with text/imageUrl
        if (parsed.text || parsed.imageUrl) {
          return (
            <div className="space-y-1">
              {parsed.text && (
                <div className="text-gray-900">{parsed.text}</div>
              )}
              {parsed.imageUrl && (
                <img
                  src={parsed.imageUrl}
                  alt="Option image"
                  className="max-w-full h-auto max-h-16 border border-gray-200 rounded"
                />
              )}
            </div>
          )
        }

        // If parsed but not recognized format, fall back to string rendering
        if (typeof parsed === 'string') {
          return <span className="text-gray-900">{parsed}</span>
        }

        // For other parsed objects, show a meaningful representation
        return `[Parsed object: ${Object.keys(parsed).join(', ')}]`
      } catch (e) {
        // Not JSON, continue with regular text rendering
      }
    }

    // Regular text rendering - just display as text for now
    return <span className="text-gray-900">{value as string}</span>
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'hard':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getModuleColor = (module: string) => {
    switch (module) {
      case 'english1':
        return 'bg-blue-100 text-blue-800'
      case 'english2':
        return 'bg-indigo-100 text-indigo-800'
      case 'math1':
        return 'bg-purple-100 text-purple-800'
      case 'math2':
        return 'bg-pink-100 text-pink-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatModuleName = (module: string) => {
    switch (module) {
      case 'english1':
        return 'English 1'
      case 'english2':
        return 'English 2'
      case 'math1':
        return 'Math 1'
      case 'math2':
        return 'Math 2'
      default:
        return module
    }
  }

  const formatQuestionType = (type: string) => {
    switch (type) {
      case 'multiple_choice':
        return 'Multiple Choice'
      case 'grid_in':
        return 'Grid-in'
      case 'essay':
        return 'Essay'
      default:
        return type
    }
  }

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestion(expandedQuestion === questionId ? null : questionId)
  }

  const createSingleQuestionPractice = async (question: Question) => {
    if (!user || !supabase) return

    setCreatingPractice(question.id)
    try {
      // Use the auth context user ID (now synchronized with Supabase session)
      let attempt

      const { data, error } = await supabase
        .from('test_attempts')
        .insert({
          user_id: user.id,
          exam_id: null, // Practice mode doesn't use exam_id
          status: 'not_started',
          is_practice_mode: true,
          current_module: question.module_type,
          current_question_number: 1,
        })
        .select()
        .single()

      if (error) {
        console.log('Direct insert failed, trying emergency function:', error)

        const { data: emergencyResult, error: emergencyError } =
          await supabase.rpc('create_practice_session', {
            target_user_id: user.id,
            module_name: question.module_type,
            is_single_question: true,
          })

        if (emergencyError || !emergencyResult?.[0]?.success) {
          throw new Error(
            emergencyError?.message ||
              emergencyResult?.[0]?.error_message ||
              'Failed to create single question practice session'
          )
        }

        // Get the created attempt
        const { data: createdAttempt, error: fetchError } = await supabase
          .from('test_attempts')
          .select()
          .eq('id', emergencyResult[0].attempt_id)
          .single()

        if (fetchError) throw fetchError
        attempt = createdAttempt
      } else {
        attempt = data
      }

      // Store practice settings and question in localStorage for the session
      const practiceData = {
        attemptId: attempt.id,
        questions: [question.id],
        settings: {
          shuffleQuestions: false,
          showExplanations: true,
          timeLimit: 0,
          isSingleQuestion: true,
        },
      }

      localStorage.setItem(
        `practice_${attempt.id}`,
        JSON.stringify(practiceData)
      )

      // Navigate to practice session
      router.push(`/student/practice/${attempt.id}`)
    } catch (error) {
      console.error('Error creating single question practice:', error)
      alert('Failed to start practice. Please try again.')
    } finally {
      setCreatingPractice(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No questions found
          </h3>
          <p className="text-gray-500 mb-4">
            Try adjusting your filters to see more questions.
          </p>
          <button
            onClick={onRefresh}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Refresh Questions
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Questions ({questions.length})
          </h3>
          <button
            onClick={onRefresh}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Refresh
          </button>
        </div>

        <div className="space-y-4">
          {questions.map((question) => (
            <div
              key={question.id}
              className={`border border-gray-200 rounded-lg p-4 transition-colors ${
                question.is_incorrect
                  ? 'border-red-200 bg-red-50'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Question Header */}
                  <div className="flex items-center space-x-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getModuleColor(question.module_type)}`}
                    >
                      {formatModuleName(question.module_type)} #
                      {question.question_number}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(question.difficulty_level)}`}
                    >
                      {question.difficulty_level}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {formatQuestionType(question.question_type)}
                    </span>
                    {question.exam_title && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
                        {question.exam_title}
                      </span>
                    )}
                    {question.is_incorrect && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Previously Incorrect
                      </span>
                    )}
                  </div>

                  {/* Question Preview */}
                  <div className="text-gray-900 text-sm mb-2">
                    {(() => {
                      // HTML-first rendering for question preview
                      let content = ''
                      if (
                        question.question_html &&
                        !isEmptyHtml(question.question_html)
                      ) {
                        content =
                          question.question_html.length > 150
                            ? `${question.question_html.substring(0, 150)}...`
                            : question.question_html
                        // For preview, just show plain text to avoid HTML complexity
                        return (
                          content.replace(/<[^>]*>/g, ' ').substring(0, 150) +
                          (content.length > 150 ? '...' : '')
                        )
                      } else {
                        content =
                          question.question_text.length > 150
                            ? `${question.question_text.substring(0, 150)}...`
                            : question.question_text
                        return content
                      }
                    })()}
                  </div>

                  {/* Topics */}
                  {question.topic_tags && question.topic_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {question.topic_tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 text-blue-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleQuestion(question.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {expandedQuestion === question.id ? 'Collapse' : 'View'}
                  </button>
                  <button
                    onClick={() => createSingleQuestionPractice(question)}
                    disabled={creatingPractice === question.id}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                  >
                    {creatingPractice === question.id
                      ? 'Starting...'
                      : 'Practice'}
                  </button>
                </div>
              </div>

              {/* Expanded Question Details */}
              {expandedQuestion === question.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-4">
                    {/* Full Question */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        Question:
                      </h4>
                      <div className="text-gray-700">
                        {(() => {
                          // HTML-first rendering for full question
                          if (
                            question.question_html &&
                            !isEmptyHtml(question.question_html)
                          ) {
                            return renderHtmlContent(question.question_html)
                          } else {
                            return (
                              <div className="whitespace-pre-wrap">
                                {question.question_text}
                              </div>
                            )
                          }
                        })()}
                      </div>
                    </div>

                    {/* Options (for multiple choice) */}
                    {question.question_type === 'multiple_choice' &&
                      question.options && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">
                            Options:
                          </h4>
                          <div className="space-y-1">
                            {Object.entries(question.options).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className={`p-2 rounded ${
                                    key === question.correct_answer
                                      ? 'bg-green-100 border border-green-300'
                                      : 'bg-gray-50'
                                  }`}
                                >
                                  <span className="font-medium">{key}.</span>{' '}
                                  {renderOptionContent(value)}
                                  {key === question.correct_answer && (
                                    <span className="ml-2 text-green-600 font-medium">
                                      (Correct)
                                    </span>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Grid-in answer */}
                    {question.question_type === 'grid_in' && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          Correct Answer:
                        </h4>
                        <div className="p-2 rounded bg-green-100 border border-green-300">
                          <span className="font-medium">
                            {question.correct_answer}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    {(question.explanation ||
                      (question.explanation_html &&
                        !isEmptyHtml(question.explanation_html))) && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">
                          Explanation:
                        </h4>
                        <div className="text-gray-700">
                          {(() => {
                            // HTML-first rendering for explanation
                            if (
                              question.explanation_html &&
                              !isEmptyHtml(question.explanation_html)
                            ) {
                              return renderHtmlContent(
                                question.explanation_html
                              )
                            } else if (question.explanation) {
                              return (
                                <div className="whitespace-pre-wrap">
                                  {question.explanation}
                                </div>
                              )
                            }
                            return null
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
