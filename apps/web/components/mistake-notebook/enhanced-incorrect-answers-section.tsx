'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '../../contexts/auth-context'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react'
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
  correct_answers?: any
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
    exam_title?: string
  }>
  examTitles?: string[]
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
  const [examFilter, setExamFilter] = useState<string>('all')
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])

  const examOptions = useMemo(() => {
    const exams = new Set<string>()
    questions.forEach((q) => {
      q.examTitles?.forEach((title) => {
        if (title) {
          exams.add(title)
        }
      })
    })
    return Array.from(exams).sort((a, b) => a.localeCompare(b))
  }, [questions])

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
        return 'MC'
      case 'grid_in':
        return 'GI'
      case 'essay':
        return 'Essay'
      default:
        return type ? type.toUpperCase() : ''
    }
  }

  const renderMasteryStatus = (status?: 'unmastered' | 'mastered') => {
    if (status === 'mastered') {
      return (
        <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 p-1 text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Mastered</span>
        </span>
      )
    }

    return (
      <span className="inline-flex items-center justify-center rounded-full bg-orange-50 p-1 text-orange-500">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">Needs review</span>
      </span>
    )
  }

  const getGroupedQuestions = () => {
    // First, apply mastery status filter
    const filteredQuestions = questions.filter((q) => {
      const matchesMastery =
        masteryFilter === 'all' ? true : q.masteryStatus === masteryFilter
      const matchesExam =
        examFilter === 'all'
          ? true
          : q.examTitles?.includes(examFilter) ?? false
      return matchesMastery && matchesExam
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
      const matchesMastery =
        masteryFilter === 'all' ? true : q.masteryStatus === masteryFilter
      const matchesExam =
        examFilter === 'all'
          ? true
          : q.examTitles?.includes(examFilter) ?? false
      return matchesMastery && matchesExam
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
          showExplanations: true,
          timeLimit: 0,
          isMistakeReview: true,
        },
        isMistakeReview: true,
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
        isMistakeReview: true,
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
    const matchesMastery =
      masteryFilter === 'all' ? true : q.masteryStatus === masteryFilter
    const matchesExam =
      examFilter === 'all'
        ? true
        : q.examTitles?.includes(examFilter) ?? false
    return matchesMastery && matchesExam
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
                Select specific questions or practice all mistakes to improve
                your performance
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
              {examFilter !== 'all' && ` • Exam: ${examFilter}`}
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
            <span className="text-sm font-medium text-gray-700 mr-4">
              Show:
            </span>
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

          {/* Exam Filter */}
          {examOptions.length > 0 && (
            <div className="mb-4">
              <span className="text-sm font-medium text-gray-700 mr-4">
                Exam:
              </span>
              <select
                value={examFilter}
                onChange={(event) => setExamFilter(event.target.value)}
                className="py-2 px-4 rounded-xl border border-purple-200 bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              >
                <option value="all">All Exams</option>
                {examOptions.map((exam) => (
                  <option key={exam} value={exam}>
                    {exam}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Group By Controls */}
        <div>
            <span className="text-sm font-medium text-gray-700 mr-4">
              Group by:
            </span>
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
        <div
          key={groupName}
          className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100"
        >
          <div className="p-6 border-b border-purple-200">
            <h4 className="text-lg font-semibold text-gray-900">
              {groupName} ({groupQuestions.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
            {groupQuestions.map((question) => {
              const isSelected = selectedQuestions.includes(question.id)
              const isExpanded = expandedQuestion === question.id
              const attempts = question.incorrectAttempts || []
              const displayedAttempts = attempts.slice(0, 3)
              const remainingAttempts =
                attempts.length > displayedAttempts.length
                  ? attempts.length - displayedAttempts.length
                  : 0

              return (
                <article
                  key={question.id}
                  className="group flex h-full flex-col rounded-2xl border border-purple-100 bg-white/90 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-purple-200 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-purple-50 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleQuestionSelect(question.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-gray-900">
                          Question {question.question_number ?? '—'}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="font-medium text-gray-600">
                            {formatModuleName(question.module_type)}
                          </span>
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                            {formatQuestionType(question.question_type)}
                          </span>
                          {renderMasteryStatus(question.masteryStatus)}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleQuestion(question.id)}
                      aria-label={
                        isExpanded ? 'Hide question details' : 'View question details'
                      }
                      className="rounded-md border border-purple-200 p-2 text-purple-600 transition-colors hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-offset-2"
                    >
                      {isExpanded ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col gap-4 px-5 py-4 text-sm text-gray-700">
                    <div className="line-clamp-5 leading-relaxed">
                      {question.question_html &&
                      !isEmptyHtml(question.question_html) ? (
                        <ContentRenderer
                          htmlContent={question.question_html}
                          className="prose-sm text-gray-700 [&_*]:!font-normal line-clamp-5"
                        />
                      ) : (
                        <p className="line-clamp-5">
                          {(() => {
                            const textPreview =
                              question.question_text?.trim() ||
                              'No preview available'
                            return textPreview.length > 180
                              ? `${textPreview.substring(0, 180)}...`
                              : textPreview
                          })()}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 text-xs text-gray-600">
                      {question.examTitles && question.examTitles.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {question.examTitles.slice(0, 2).map((title, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 font-medium text-blue-700"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                              {title}
                            </span>
                          ))}
                          {question.examTitles.length > 2 && (
                            <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 font-medium text-blue-600">
                              +{question.examTitles.length - 2} more
                            </span>
                          )}
                        </div>
                      )}

                      {question.topic_tags && question.topic_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {question.topic_tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700"
                            >
                              #{tag}
                            </span>
                          ))}
                          {question.topic_tags.length > 3 && (
                            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium text-gray-600">
                              +{question.topic_tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-auto flex items-center justify-between text-xs text-gray-500">
                      <span>
                        First mistaken:{' '}
                        {question.firstMistakenAt
                          ? new Date(
                              question.firstMistakenAt
                            ).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Unknown'}
                      </span>
                      <span>
                        {question.incorrectAttempts?.length ?? 0} incorrect attempt
                        {question.incorrectAttempts &&
                        question.incorrectAttempts.length !== 1
                          ? 's'
                          : ''}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-purple-100 px-5 pb-5 pt-4">
                      <div className="space-y-4">
                        <section>
                          <h5 className="text-sm font-semibold text-gray-900">
                            Question passage
                          </h5>
                          <div className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-purple-100 bg-white p-3 text-sm leading-relaxed text-gray-700">
                            {question.question_html &&
                            !isEmptyHtml(question.question_html) ? (
                              <ContentRenderer
                                htmlContent={question.question_html}
                                className="prose-sm text-gray-700 [&_*]:!font-normal"
                              />
                            ) : (
                              <p className="whitespace-pre-wrap">
                                {question.question_text?.trim() ||
                                  'Question content not available.'}
                              </p>
                            )}
                          </div>
                        </section>

                        {displayedAttempts.length > 0 && (
                          <section>
                            <h5 className="text-sm font-semibold text-gray-900">
                              Recent incorrect attempts
                            </h5>
                            <div className="mt-2 space-y-2">
                              {displayedAttempts.map((attempt, index) => (
                                <div
                                  key={attempt.id}
                                  className="rounded-lg border border-purple-100 bg-white px-3 py-2 text-xs text-gray-600"
                                >
                                  <div className="flex justify-between">
                                    <span className="font-semibold text-gray-700">
                                      Attempt #{index + 1}
                                    </span>
                                    <span>
                                      {new Date(attempt.answered_at).toLocaleDateString(
                                        'en-US',
                                        {
                                          year: 'numeric',
                                          month: 'short',
                                          day: 'numeric',
                                        }
                                      )}
                                    </span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                      Your answer:{' '}
                                      <span className="font-semibold">
                                        {attempt.user_answer}
                                      </span>
                                    </span>
                                    <Link
                                      href={`/student/results/${attempt.attempt_id}/review`}
                                      className="text-purple-600 hover:text-purple-800"
                                    >
                                      View attempt →
                                    </Link>
                                  </div>
                                  {attempt.exam_title && (
                                    <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 font-medium text-blue-600">
                                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                                      {attempt.exam_title}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {remainingAttempts > 0 && (
                                <div className="rounded-lg border border-dashed border-purple-200 px-3 py-2 text-xs text-purple-700">
                                  +{remainingAttempts} more attempts logged
                                </div>
                              )}
                            </div>
                          </section>
                        )}

                        <section className="rounded-xl border border-purple-100 bg-purple-50/60 px-4 py-3 text-sm text-purple-700">
                          <p>
                            Ready to practice this question again? Use the actions
                            below to take it into a focused session.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleQuestionSelect(question.id)}
                              className="rounded-md border border-purple-200 px-3 py-2 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-100"
                            >
                              {isSelected ? 'Remove from selection' : 'Select for practice'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                router.push(`/student/problem-bank/${question.id}`)
                              }
                              className="rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
                            >
                              Open full question
                            </button>
                          </div>
                        </section>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
