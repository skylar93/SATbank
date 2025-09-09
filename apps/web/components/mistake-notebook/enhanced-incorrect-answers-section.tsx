'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/auth-context'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { renderHtmlContent } from '../exam/question-display'
import { isEmptyHtml } from '../../lib/content-converter'
import { ContentRenderer } from '../content-renderer'

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
  // Use the centralized Supabase client
  const [groupBy, setGroupBy] = useState<
    'module' | 'difficulty' | 'topic' | 'recent'
  >('recent')
  const [masteryFilter, setMasteryFilter] = useState<
    'all' | 'unmastered' | 'mastered'
  >('all')
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
    // First, apply mastery status filter
    const filteredQuestions = questions.filter((q) => {
      if (masteryFilter === 'all') return true
      return q.masteryStatus === masteryFilter
    })

    const grouped: { [key: string]: Question[] } = {}

    switch (groupBy) {
      case 'module':
        filteredQuestions.forEach((q) => {
          const key = formatModuleName(q.module_type)
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(q)
        })
        break

      case 'difficulty':
        filteredQuestions.forEach((q) => {
          const key =
            q.difficulty_level.charAt(0).toUpperCase() +
            q.difficulty_level.slice(1)
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(q)
        })
        break

      case 'topic':
        filteredQuestions.forEach((q) => {
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
        grouped['All Mistake Questions'] = filteredQuestions.sort((a, b) => {
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
    const filteredQuestions = questions.filter((q) => {
      if (masteryFilter === 'all') return true
      return q.masteryStatus === masteryFilter
    })

    const filteredQuestionIds = filteredQuestions.map((q) => q.id)
    const allFilteredSelected = filteredQuestionIds.every((id) =>
      selectedQuestions.includes(id)
    )

    if (allFilteredSelected) {
      // Deselect all filtered questions
      setSelectedQuestions((prev) =>
        prev.filter((id) => !filteredQuestionIds.includes(id))
      )
    } else {
      // Select all filtered questions (keeping existing selections from other filters)
      setSelectedQuestions((prev) => [
        ...new Set([...prev, ...filteredQuestionIds]),
      ])
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
          showExplanations: false, // Disabled to match exam behavior
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
          showExplanations: false, // Disabled to match exam behavior
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
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-purple-200 rounded-xl p-4">
              <div className="h-4 bg-purple-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-purple-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-8 text-center">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-purple-500 text-2xl">✅</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No incorrect answers yet!
        </h3>
        <p className="text-gray-600 mb-4">
          Great job! You haven't answered any questions incorrectly yet. Keep
          practicing to maintain your streak.
        </p>
        <Link
          href="/student/exams"
          className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg"
        >
          Take Practice Exam
        </Link>
      </div>
    )
  }

  const groupedQuestions = getGroupedQuestions()
  const filteredQuestions = questions.filter((q) => {
    if (masteryFilter === 'all') return true
    return q.masteryStatus === masteryFilter
  })

  return (
    <div className="space-y-6">
      {/* Action Buttons Section */}
      <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl shadow-lg border border-purple-200 p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-violet-500 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl">🎯</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Practice Your Mistakes
              </h3>
              <p className="text-gray-600 text-sm">
                Select specific questions or practice all mistakes to improve your performance
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={generatePracticeFromAll}
              className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Practice All →
            </button>
          </div>
        </div>
      </div>

      {/* Header and Controls */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              📚 Mistake Questions ({filteredQuestions.length}
              {masteryFilter !== 'all' ? ` of ${questions.length}` : ''})
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Review and practice questions you've answered incorrectly
              {masteryFilter !== 'all' &&
                ` • Showing ${masteryFilter} questions only`}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSelectAll}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
            >
              {(() => {
                const filteredIds = filteredQuestions.map((q) => q.id)
                const allFilteredSelected = filteredIds.every((id) =>
                  selectedQuestions.includes(id)
                )
                return allFilteredSelected && filteredIds.length > 0
                  ? 'Deselect All'
                  : 'Select All'
              })()}
            </button>
            <button
              onClick={createPracticeQuizFromSelected}
              disabled={selectedQuestions.length === 0}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Create Quiz ({selectedQuestions.length})
            </button>
            <button
              onClick={onRefresh}
              className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Filter and Group Controls */}
        <div className="mt-6 pt-6 border-t border-purple-200">
          {/* Mastery Filter */}
          <div className="mb-4">
            <span className="text-sm font-medium text-gray-700 mr-4">Show:</span>
            <div className="inline-flex space-x-1">
              {[
                { value: 'all', label: 'All Questions' },
                { value: 'unmastered', label: 'Unmastered' },
                { value: 'mastered', label: 'Mastered' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setMasteryFilter(option.value as any)}
                  className={`py-2 px-4 rounded-xl font-medium text-sm transition-all duration-200 ${
                    masteryFilter === option.value
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                      : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Group By Controls */}
          <div>
            <span className="text-sm font-medium text-gray-700 mr-4">Group by:</span>
            <div className="inline-flex space-x-1">
              {[
                { value: 'recent', label: 'Most Recent' },
                { value: 'module', label: 'Module' },
                { value: 'difficulty', label: 'Difficulty' },
                { value: 'topic', label: 'Topic' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setGroupBy(option.value as any)}
                  className={`py-2 px-4 rounded-xl font-medium text-sm transition-all duration-200 ${
                    groupBy === option.value
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                      : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Questions */}
      {Object.entries(groupedQuestions).map(([groupName, groupQuestions]) => (
        <div key={groupName} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100">
          <div className="p-6 border-b border-purple-200">
            <h4 className="text-lg font-semibold text-gray-900">
              {groupName} ({groupQuestions.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
            {groupQuestions.map((question) => (
              <div
                key={question.id}
                className="group bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-red-200 hover:shadow-xl hover:border-purple-300 transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between p-6 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedQuestions.includes(question.id)}
                        onChange={() => handleQuestionSelect(question.id)}
                        className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                    </div>
                    <div className="flex-shrink-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium transition-all duration-300 ${
                          question.masteryStatus === 'mastered'
                            ? 'bg-purple-500 shadow-purple-200 shadow-lg'
                            : 'bg-red-500 shadow-red-200 shadow-lg'
                        }`}
                      >
                        {question.masteryStatus === 'mastered' ? '✓' : '✗'}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        Question {question.question_number} - {formatModuleName(question.module_type)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 flex-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${
                          question.difficulty_level === 'hard' 
                            ? 'bg-rose-50 text-rose-700 border-rose-200' 
                            : question.difficulty_level === 'medium'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {question.difficulty_level}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">
                          {formatQuestionType(question.question_type)}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${
                            question.masteryStatus === 'mastered'
                              ? 'bg-violet-50 text-violet-700 border-violet-200'
                              : 'bg-orange-50 text-orange-700 border-orange-200'
                          }`}
                        >
                          {question.masteryStatus === 'mastered' ? '✓ Mastered' : '⚠ Practice'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleQuestion(question.id)}
                      className="text-purple-600 hover:text-purple-800 text-sm font-medium px-3 py-1 rounded-lg hover:bg-purple-50 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      {expandedQuestion === question.id ? 'Hide' : 'Review'}
                    </button>
                  </div>
                </div>

                {/* Question Preview */}
                <div className="px-6 pb-4">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {(() => {
                      // HTML-first rendering for question preview
                      let content = ''
                      if (question.question_html && !isEmptyHtml(question.question_html)) {
                        content = question.question_html
                        // For preview, show plain text to avoid HTML complexity
                        const cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
                        return cleanText.length > 120 ? `${cleanText.substring(0, 120)}...` : cleanText
                      } else {
                        content = question.question_text || 'No preview available'
                        return content.length > 120 ? `${content.substring(0, 120)}...` : content
                      }
                    })()}
                  </p>
                </div>

                {/* Topics and Footer */}
                <div className="px-6 pb-6">
                  {question.topic_tags && question.topic_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {question.topic_tags.slice(0, 3).map((tag: string, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                        >
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-1.5"></span>
                          {tag}
                        </span>
                      ))}
                      {question.topic_tags.length > 3 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                          +{question.topic_tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      First mistake: {question.firstMistakenAt ? new Date(question.firstMistakenAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      }) : 'Unknown'}
                    </span>
                    <span>
                      {question.incorrectAttempts?.length || 1} incorrect attempt{(question.incorrectAttempts?.length || 1) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Expanded Question Details */}
                {expandedQuestion === question.id && (
                  <div className="border-t border-purple-200 bg-purple-50/30 rounded-b-2xl mx-0">
                    <div className="p-6">
                    <div className="space-y-4">
                      {/* Full Question */}
                      <div>
                        <h5 className="font-medium text-gray-900 mb-2">
                          Question:
                        </h5>
                        <div className="text-gray-700">
                          {(() => {
                            // HTML-first rendering for full question
                            if (question.question_html && !isEmptyHtml(question.question_html)) {
                              // Check if content contains LaTeX math expressions
                              if (question.question_html.includes('data-math')) {
                                return <ContentRenderer htmlContent={question.question_html} />
                              } else {
                                return renderHtmlContent(question.question_html)
                              }
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
                                    className={`p-2 rounded-lg ${
                                      key === question.correct_answer
                                        ? 'bg-purple-100 border border-purple-300'
                                        : question.incorrectAttempts?.some(
                                              (att) => att.user_answer === key
                                            )
                                          ? 'bg-red-100 border border-red-300'
                                          : 'bg-gray-50'
                                    }`}
                                  >
                                    <span className="font-medium">{key}.</span>{' '}
                                    <span className="text-gray-900">
                                      {(() => {
                                        // Check if options_html exists and has this key
                                        if (question.options_html && question.options_html[key] && !isEmptyHtml(question.options_html[key])) {
                                          // If HTML content contains math expressions, render properly
                                          if (question.options_html[key].includes('data-math')) {
                                            return <ContentRenderer htmlContent={question.options_html[key]} />
                                          } else {
                                            return <span dangerouslySetInnerHTML={{ __html: question.options_html[key] }} />
                                          }
                                        } else {
                                          // Fallback to regular text option
                                          return value as string
                                        }
                                      })()}
                                    </span>
                                    {key === question.correct_answer && (
                                      <span className="ml-2 text-purple-600 font-medium">
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
                            <div className="p-2 rounded-lg bg-purple-100 border border-purple-300">
                              <span className="font-medium text-purple-800">
                                {question.correct_answer}
                              </span>
                            </div>
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">
                              Your Answer:
                            </h5>
                            <div className="p-2 rounded-lg bg-red-100 border border-red-300">
                              <span className="font-medium text-red-800">
                                {question.incorrectAttempts?.[0]?.user_answer ||
                                  'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Explanation */}
                      {(question.explanation || (question.explanation_html && !isEmptyHtml(question.explanation_html))) && (
                        <div>
                          <h5 className="font-medium text-gray-900 mb-2">
                            Explanation:
                          </h5>
                          <div className="p-3 bg-purple-50 rounded-lg">
                            <div className="text-gray-800">
                              {(() => {
                                // HTML-first rendering for explanation
                                if (question.explanation_html && !isEmptyHtml(question.explanation_html)) {
                                  // Check if content contains LaTeX math expressions
                                  if (question.explanation_html.includes('data-math')) {
                                    return <ContentRenderer htmlContent={question.explanation_html} />
                                  } else {
                                    return renderHtmlContent(question.explanation_html)
                                  }
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
