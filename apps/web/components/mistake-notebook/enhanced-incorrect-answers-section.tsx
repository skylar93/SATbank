'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/auth-context'
import { createClient } from '../../lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

interface EnhancedIncorrectAnswersSectionProps {
  questions: Question[]
  loading: boolean
  onRefresh: () => void
}

export function EnhancedIncorrectAnswersSection({
  questions,
  loading,
  onRefresh,
}: EnhancedIncorrectAnswersSectionProps) {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [groupBy, setGroupBy] = useState<
    'module' | 'difficulty' | 'topic' | 'recent'
  >('recent')
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])

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

  const getGroupedQuestions = () => {
    const grouped: { [key: string]: Question[] } = {}

    switch (groupBy) {
      case 'module':
        questions.forEach((q) => {
          const key = formatModuleName(q.module_type)
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(q)
        })
        break

      case 'difficulty':
        questions.forEach((q) => {
          const key =
            q.difficulty_level.charAt(0).toUpperCase() +
            q.difficulty_level.slice(1)
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(q)
        })
        break

      case 'topic':
        questions.forEach((q) => {
          if (q.topic_tags && q.topic_tags.length > 0) {
            q.topic_tags.forEach((topic) => {
              if (!grouped[topic]) grouped[topic] = []
              grouped[topic].push(q)
            })
          } else {
            if (!grouped['Untagged']) grouped['Untagged'] = []
            grouped['Untagged'].push(q)
          }
        })
        break

      case 'recent':
      default:
        grouped['All Mistake Questions'] = questions.sort((a, b) => {
          const aLatest = Math.max(
            ...(a.incorrectAttempts?.map((att) =>
              new Date(att.answered_at).getTime()
            ) || [0])
          )
          const bLatest = Math.max(
            ...(b.incorrectAttempts?.map((att) =>
              new Date(att.answered_at).getTime()
            ) || [0])
          )
          return bLatest - aLatest
        })
        break
    }

    return grouped
  }

  const toggleQuestion = (questionId: string) => {
    setExpandedQuestion(expandedQuestion === questionId ? null : questionId)
  }

  const handleQuestionSelect = (questionId: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId]
    )
  }

  const handleSelectAll = () => {
    if (selectedQuestions.length === questions.length) {
      setSelectedQuestions([])
    } else {
      setSelectedQuestions(questions.map((q) => q.id))
    }
  }

  const createPracticeQuizFromSelected = async () => {
    if (selectedQuestions.length === 0 || !user) return

    try {
      // Create a practice attempt with only selected incorrect questions
      const { data: attempt, error: attemptError } = await supabase
        .from('test_attempts')
        .insert({
          user_id: user.id,
          exam_id: null,
          status: 'not_started',
          is_practice_mode: true,
          current_module:
            questions.find((q) => selectedQuestions.includes(q.id))
              ?.module_type || 'english1',
          current_question_number: 1,
        })
        .select()
        .single()

      if (attemptError) throw attemptError

      // Store practice data
      const practiceData = {
        attemptId: attempt.id,
        questions: selectedQuestions,
        settings: {
          shuffleQuestions: false,
          showExplanations: true,
          timeLimit: 0,
          isMistakeReview: true,
        },
      }

      localStorage.setItem(
        `practice_${attempt.id}`,
        JSON.stringify(practiceData)
      )

      // Navigate to practice session
      router.push(`/student/practice/${attempt.id}`)
    } catch (error) {
      console.error(
        'Error creating practice quiz from selected mistakes:',
        error
      )
      alert('Failed to create practice quiz. Please try again.')
    }
  }

  const generatePracticeFromAll = async () => {
    if (questions.length === 0 || !user) return

    try {
      // Create a practice attempt with all incorrect questions
      const { data: attempt, error: attemptError } = await supabase
        .from('test_attempts')
        .insert({
          user_id: user.id,
          exam_id: null,
          status: 'not_started',
          is_practice_mode: true,
          current_module: questions[0]?.module_type || 'english1',
          current_question_number: 1,
        })
        .select()
        .single()

      if (attemptError) throw attemptError

      // Store practice data
      const practiceData = {
        attemptId: attempt.id,
        questions: questions.map((q) => q.id),
        settings: {
          shuffleQuestions: true,
          showExplanations: true,
          timeLimit: 0,
          isMistakeReview: true,
        },
      }

      localStorage.setItem(
        `practice_${attempt.id}`,
        JSON.stringify(practiceData)
      )

      // Navigate to practice session
      router.push(`/student/practice/${attempt.id}`)
    } catch (error) {
      console.error('Error generating practice from all mistakes:', error)
      alert('Failed to generate practice quiz. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No incorrect answers yet!
        </h3>
        <p className="text-gray-500 mb-4">
          Great job! You haven't answered any questions incorrectly yet. Keep
          practicing to maintain your streak.
        </p>
        <Link
          href="/student/exams"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          Take Practice Exam
        </Link>
      </div>
    )
  }

  const groupedQuestions = getGroupedQuestions()

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Mistake Questions ({questions.length})
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Review and practice questions you've answered incorrectly
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSelectAll}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {selectedQuestions.length === questions.length
                ? 'Deselect All'
                : 'Select All'}
            </button>
            <button
              onClick={createPracticeQuizFromSelected}
              disabled={selectedQuestions.length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              Create Practice Quiz from Selected ({selectedQuestions.length})
            </button>
            <button
              onClick={generatePracticeFromAll}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              Practice All Mistakes
            </button>
            <button
              onClick={onRefresh}
              className="text-gray-500 hover:text-gray-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Group By Controls */}
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Group by:</span>
          {[
            { value: 'recent', label: 'Most Recent' },
            { value: 'module', label: 'Module' },
            { value: 'difficulty', label: 'Difficulty' },
            { value: 'topic', label: 'Topic' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setGroupBy(option.value as any)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                groupBy === option.value
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Questions */}
      {Object.entries(groupedQuestions).map(([groupName, groupQuestions]) => (
        <div key={groupName} className="bg-white rounded-lg shadow">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">
              {groupName} ({groupQuestions.length})
            </h4>
          </div>

          <div className="p-4 space-y-4">
            {groupQuestions.map((question) => (
              <div
                key={question.id}
                className="border border-red-200 rounded-lg p-4 bg-red-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {/* Checkbox for selection */}
                    <input
                      type="checkbox"
                      checked={selectedQuestions.includes(question.id)}
                      onChange={() => handleQuestionSelect(question.id)}
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
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
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Incorrect {question.incorrectAttempts?.length || 0}{' '}
                          time(s)
                        </span>
                      </div>

                      {/* Question Preview */}
                      <p className="text-gray-900 text-sm mb-2">
                        {question.question_text.length > 150
                          ? `${question.question_text.substring(0, 150)}...`
                          : question.question_text}
                      </p>

                      {/* Latest Incorrect Answer */}
                      {question.incorrectAttempts &&
                        question.incorrectAttempts.length > 0 && (
                          <div className="bg-white border border-red-200 rounded p-2 mb-2">
                            <p className="text-xs text-gray-600 mb-1">
                              Latest incorrect answer:{' '}
                              <span className="font-medium text-red-600">
                                {question.incorrectAttempts[0].user_answer}
                              </span>
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(
                                question.incorrectAttempts[0].answered_at
                              ).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        )}

                      {/* Topics */}
                      {question.topic_tags &&
                        question.topic_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
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
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleQuestion(question.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {expandedQuestion === question.id ? 'Collapse' : 'Review'}
                    </button>
                    <Link
                      href={`/student/practice/${question.id}`}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                    >
                      Practice
                    </Link>
                  </div>
                </div>

                {/* Expanded Question Details */}
                {expandedQuestion === question.id && (
                  <div className="mt-4 pt-4 border-t border-red-200">
                    <div className="space-y-4">
                      {/* Full Question */}
                      <div>
                        <h5 className="font-medium text-gray-900 mb-2">
                          Question:
                        </h5>
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {question.question_text}
                        </p>
                      </div>

                      {/* Options and Correct Answer */}
                      {question.question_type === 'multiple_choice' &&
                        question.options && (
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">
                              Options:
                            </h5>
                            <div className="space-y-1">
                              {Object.entries(question.options).map(
                                ([key, value]) => (
                                  <div
                                    key={key}
                                    className={`p-2 rounded ${
                                      key === question.correct_answer
                                        ? 'bg-green-100 border border-green-300'
                                        : question.incorrectAttempts?.some(
                                              (att) => att.user_answer === key
                                            )
                                          ? 'bg-red-100 border border-red-300'
                                          : 'bg-gray-50'
                                    }`}
                                  >
                                    <span className="font-medium">{key}.</span>{' '}
                                    {value as string}
                                    {key === question.correct_answer && (
                                      <span className="ml-2 text-green-600 font-medium">
                                        (Correct)
                                      </span>
                                    )}
                                    {question.incorrectAttempts?.some(
                                      (att) => att.user_answer === key
                                    ) && (
                                      <span className="ml-2 text-red-600 font-medium">
                                        (Your Answer)
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
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">
                              Correct Answer:
                            </h5>
                            <div className="p-2 rounded bg-green-100 border border-green-300">
                              <span className="font-medium">
                                {question.correct_answer}
                              </span>
                            </div>
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">
                              Your Answer:
                            </h5>
                            <div className="p-2 rounded bg-red-100 border border-red-300">
                              <span className="font-medium">
                                {question.incorrectAttempts?.[0]?.user_answer ||
                                  'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Explanation */}
                      {question.explanation && (
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">
                            Explanation:
                          </h5>
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {question.explanation}
                          </p>
                        </div>
                      )}

                      {/* All Incorrect Attempts */}
                      {question.incorrectAttempts &&
                        question.incorrectAttempts.length > 1 && (
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">
                              All Incorrect Attempts:
                            </h5>
                            <div className="space-y-2">
                              {question.incorrectAttempts.map(
                                (attempt, index) => (
                                  <div
                                    key={attempt.id}
                                    className="bg-red-50 border border-red-200 rounded p-2"
                                  >
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm">
                                        <span className="font-medium">
                                          Answer:
                                        </span>{' '}
                                        {attempt.user_answer}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {new Date(
                                          attempt.answered_at
                                        ).toLocaleDateString('en-US', {
                                          year: 'numeric',
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>
                                  </div>
                                )
                              )}
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
      ))}
    </div>
  )
}
