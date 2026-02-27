'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../../../contexts/auth-context'
import { supabase } from '../../../../lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
// import { WysiwygEditor } from '../../../../components/wysiwyg-editor' // KEEPING COMMENTED OUT - HTML conversion functionality removed

interface Question {
  id: string
  question_number: number
  module_type: string
  question_type: string
  difficulty_level: string
  question_text: string
  question_image_url?: string
  table_data?: unknown
  options?: Record<string, unknown>
  correct_answer: string | string[]
  correct_answers?: string[] | null
  explanation?: string
  topic_tags?: string[]
  exam_id?: string
  exam_title?: string
}

interface Exam {
  id: string
  title: string
  description?: string
  created_at: string
}

// Row-limit safety ceilings for Supabase PostgREST queries.
// Supabase's default max-rows is 1,000. These values exceed known dataset sizes.
// Largest exam: 98 questions (SAT) | Largest module: 1,513 (english1) | Search: results are always small
const EXAM_QUERY_LIMIT = 199
const MODULE_QUERY_LIMIT = 1999
const SEARCH_QUERY_LIMIT = 999

export default function ManageExamsPage() {
  const { user, isAdmin } = useAuth()
  const [questions, setQuestions] = useState<Question[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedModule, setSelectedModule] = useState<string>('all')
  const [selectedExam, setSelectedExam] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [fetchMode, setFetchMode] = useState<'filtered' | 'search' | 'empty'>('empty')

  // Utility functions removed to fix TypeScript errors

  const renderHtmlContent = (html: string) => {
    if (!html) return ''

    // Clean HTML and handle math expressions
    const processedHtml = html
      .replace(
        /\$\$([\s\S]*?)\$\$/g,
        '<span class="bg-purple-100 px-1 rounded text-purple-800 font-mono">$$$1$$</span>'
      )
      .replace(
        /\$([^$\n]*?)\$/g,
        '<span class="bg-purple-100 px-1 rounded text-purple-800 font-mono">$$$1$$</span>'
      )
      .replace(/---/g, '—')

    return (
      <div
        dangerouslySetInnerHTML={{ __html: processedHtml }}
        className="prose prose-sm max-w-none"
      />
    )
  }

  const fetchExams = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('id, title, description, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching exams:', error)
        return
      }

      setExams(data || [])
    } catch (error) {
      console.error('Error:', error)
    }
  }, [])

  const fetchQuestions = useCallback(
    async (forceRefresh = false, retryCount = 0) => {
      try {
        setLoading(true)

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          if (retryCount < 2) {
            setTimeout(() => fetchQuestions(forceRefresh, retryCount + 1), 1000)
            return
          }
        }

        if (!session?.user) {
          if (retryCount === 0) {
            const { data: refreshed } = await supabase.auth.refreshSession()
            if (refreshed.session) {
              setTimeout(
                () => fetchQuestions(forceRefresh, retryCount + 1),
                500
              )
              return
            }
          }
          setLoading(false)
          return
        }

        const hasSearch = debouncedSearch.trim().length > 0
        const hasExamFilter = selectedExam !== 'all'
        const hasModuleFilter = selectedModule !== 'all'

        // If nothing is active, skip the DB query entirely and show the info banner
        if (!hasSearch && !hasExamFilter && !hasModuleFilter) {
          setFetchMode('empty')
          setQuestions([])
          setLoading(false)
          return
        }

        let query = supabase
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
          .order('module_type', { ascending: true })
          .order('question_number', { ascending: true })

        if (hasSearch) {
          // Server-side ilike on question_text searches across all 5,116+ questions.
          // Options text is matched client-side after fetch via getOptionsText().
          setFetchMode('search')
          query = query.ilike('question_text', `%${debouncedSearch.trim()}%`)
          if (hasExamFilter) query = query.eq('exam_id', selectedExam)
          if (hasModuleFilter) query = query.eq('module_type', selectedModule)
          query = query.range(0, SEARCH_QUERY_LIMIT)
        } else {
          // Filtered browse: apply exam/module filters with a safe row ceiling
          setFetchMode('filtered')
          if (hasExamFilter) query = query.eq('exam_id', selectedExam)
          if (hasModuleFilter) query = query.eq('module_type', selectedModule)
          // Exam-only: max 98 rows (SAT) or 39 (TCF) — EXAM_QUERY_LIMIT is ample
          // Module or both: up to 1,513 rows (english1) — MODULE_QUERY_LIMIT covers all
          const rangeEnd = hasExamFilter && !hasModuleFilter ? EXAM_QUERY_LIMIT : MODULE_QUERY_LIMIT
          query = query.range(0, rangeEnd)
        }

        const { data, error } = await query

        if (error) {
          alert(`Error fetching questions: ${error.message}`)
          return
        }

        // Process questions to include exam title
        const processedQuestions = (data || []).map((q) => ({
          ...q,
          exam_title: q.exams?.title || null,
        }))

        setQuestions(processedQuestions)
      } catch (error) {
        if (retryCount < 2) {
          setTimeout(() => fetchQuestions(forceRefresh, retryCount + 1), 2000)
        }
      } finally {
        setLoading(false)
      }
    },
    [selectedExam, selectedModule, debouncedSearch]
  )

  // Debounce search input to avoid re-filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    if (user && isAdmin) {
      fetchExams()
    }
  }, [user, isAdmin, fetchExams])

  // Utility functions (keeping for potential future use)
  // const isMarkdown = (text: string) => {
  //   if (!text) return false
  //   // Check for markdown patterns
  //   return (
  //     text.includes('**') ||
  //     text.includes('__') ||
  //     text.includes('*') ||
  //     text.includes('^^') ||
  //     text.includes('~~') ||
  //     text.includes('\n\n') ||
  //     text.includes('---') ||
  //     text.match(/\$.*?\$/)
  //   )
  // }

  // const extractTableData = (text: string) => {
  //   if (!text) return null
  //
  //   const tableMatch = text.match(/{{table}}([\s\S]*?){{\/table}}/)
  //   if (!tableMatch) return null
  //
  //   const tableContent = tableMatch[1].trim()
  //   const lines = tableContent.split('\n').filter((line) => line.trim())
  //
  //   if (lines.length >= 3) {
  //     const headers = lines[0].split('|').map((h) => h.trim())
  //     const rows = lines
  //       .slice(2)
  //       .map((line) => line.split('|').map((cell) => cell.trim()))
  //
  //     return { headers, rows }
  //   }
  //
  //   return null
  // }

  useEffect(() => {
    if (isAdmin) {
      fetchQuestions()
    }
  }, [selectedExam, selectedModule, isAdmin, fetchQuestions])

  // Strip HTML tags to make plain-text search work on HTML-formatted question content
  const stripHtml = (html: string) =>
    html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()

  // Extract searchable plain text from the options object (supports string values and {text, imageUrl} shapes)
  const getOptionsText = (options: Record<string, unknown> | undefined | null): string => {
    if (!options) return ''
    return Object.values(options)
      .map((v) => {
        if (typeof v === 'string') {
          try {
            const parsed = JSON.parse(v)
            return typeof parsed === 'object' && parsed !== null && 'text' in parsed
              ? stripHtml(String(parsed.text))
              : stripHtml(v)
          } catch {
            return stripHtml(v)
          }
        }
        if (typeof v === 'object' && v !== null && 'text' in v) {
          return stripHtml(String((v as Record<string, unknown>).text))
        }
        return ''
      })
      .join(' ')
  }

  // Module filtering is handled server-side; search is client-side (debounced) across question text + options
  const filteredQuestions = questions.filter((question) => {
    if (!debouncedSearch) return true
    const term = debouncedSearch.toLowerCase()
    const questionText = stripHtml(question.question_text || '').toLowerCase()
    const optionsText = getOptionsText(question.options).toLowerCase()
    const questionNum = String(question.question_number)
    return (
      questionText.includes(term) ||
      optionsText.includes(term) ||
      question.id.toLowerCase().includes(term) ||
      questionNum.includes(term)
    )
  })

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600">
            You need admin privileges to access this page.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-600">Loading questions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
            <p className="text-gray-600">
              Review and edit exam questions and content
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user?.profile?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
          </div>
        </div>

        {/* Separator line */}
        <div className="border-b border-gray-200"></div>
      </div>

      <div className="p-6">
        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-purple-600 mb-2">
                Search Questions
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by question text or ID..."
                className="w-full px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-600 mb-2">
                Exam
              </label>
              <select
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                className="px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Exams</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-600 mb-2">
                Module
              </label>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Modules</option>
                <option value="english1">English 1</option>
                <option value="english2">English 2</option>
                <option value="math1">Math 1</option>
                <option value="math2">Math 2</option>
                <option value="tcf_reading">TCF Reading</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="text-sm text-purple-600/70">
                Showing {filteredQuestions.length} questions
                {selectedExam !== 'all' && (
                  <span className="ml-2 px-2 py-1 bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 rounded text-xs">
                    {exams.find((exam) => exam.id === selectedExam)?.title}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      viewMode === 'table'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      viewMode === 'cards'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Cards
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedExam !== 'all' && (
                <Link
                  href={`/admin/exams/${selectedExam}/preview`}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-md hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-lg"
                >
                  Preview & Edit Exam
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Empty State Banner — shown when no filter or search is active */}
        {fetchMode === 'empty' && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center mb-6">
            <div className="text-3xl mb-3">🔍</div>
            <div className="text-blue-700 text-lg font-semibold mb-2">
              시험 또는 모듈을 선택하거나 검색어를 입력하세요
            </div>
            <p className="text-blue-600 text-sm">
              검색어 입력 시 전체 문제에서 서버사이드 검색합니다.
              필터 없이 전체 로드 시 Supabase 쿼리 한도(1,000개)를 초과해 결과가 잘릴 수 있습니다.
            </p>
          </div>
        )}

        {/* Questions List */}
        {fetchMode !== 'empty' && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100">
          {viewMode === 'table' ? (
            <div className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                        Question
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                        Module
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                        Exam
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                        Difficulty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                        Answer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-100">
                    {filteredQuestions.map((question) => (
                      <tr
                        key={question.id}
                        className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-purple-900 mr-2">
                              Q{question.question_number}
                            </span>
                            <div className="max-w-md">
                              <div className="text-sm text-purple-900 truncate">
                                {renderHtmlContent(
                                  question.question_text.substring(0, 100) +
                                    (question.question_text.length > 100
                                      ? '...'
                                      : '')
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-1 text-xs font-medium bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 rounded">
                            {question.module_type
                              .replace(/(\d)/, ' $1')
                              .toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {question.exam_title ? (
                            <span className="px-2 py-1 text-xs font-medium bg-violet-100 text-violet-800 rounded">
                              {question.exam_title}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">
                              No exam
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-purple-900">
                            {question.question_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              question.difficulty_level === 'easy'
                                ? 'bg-purple-100 text-purple-800'
                                : question.difficulty_level === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {question.difficulty_level}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            {question.correct_answer}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/admin/exams/${question.exam_id}/preview`}
                            className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                          >
                            Preview & Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {filteredQuestions.map((question) => (
                <div
                  key={question.id}
                  className="border rounded-xl p-6 border-purple-200 bg-white/50 backdrop-blur-sm"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <span className="px-2 py-1 bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 rounded text-sm font-medium">
                        {question.module_type
                          .replace(/(\d)/, ' $1')
                          .toUpperCase()}{' '}
                        - Q{question.question_number}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-sm font-medium ${
                          question.difficulty_level === 'easy'
                            ? 'bg-purple-100 text-purple-800'
                            : question.difficulty_level === 'medium'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {question.difficulty_level}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-purple-800 rounded text-sm">
                        {question.question_type.replace('_', ' ')}
                      </span>
                      {question.exam_title && (
                        <span className="px-2 py-1 bg-violet-100 text-violet-800 rounded text-sm">
                          {question.exam_title}
                        </span>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <Link
                        href={`/admin/exams/${question.exam_id}/preview`}
                        className="px-3 py-1 bg-violet-600 text-white rounded text-sm hover:bg-violet-700"
                      >
                        Preview & Edit Exam
                      </Link>
                    </div>
                  </div>

                  {/* Question Content */}
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">
                      Question Text:
                    </h3>
                    <div className="p-3 bg-gray-50 rounded-md">
                      <div className="text-gray-900 leading-relaxed">
                        {renderHtmlContent(question.question_text)}
                      </div>
                    </div>
                  </div>

                  {/* Options for Multiple Choice */}
                  {question.question_type === 'multiple_choice' && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-900 mb-2">
                        Answer Options:
                      </h3>
                      <div className="space-y-2">
                        {question.options &&
                        Object.keys(question.options).length > 0 ? (
                          Object.entries(question.options).map(
                            ([key, value]) => {
                              let optionData
                              try {
                                optionData =
                                  typeof value === 'string'
                                    ? JSON.parse(value)
                                    : value
                                if (typeof optionData !== 'object') {
                                  optionData = { text: String(value) }
                                }
                              } catch {
                                optionData = { text: String(value) }
                              }

                              return (
                                <div
                                  key={key}
                                  className="flex items-start space-x-2"
                                >
                                  <span
                                    className={`font-medium w-6 ${
                                      question.correct_answer === key
                                        ? 'text-purple-600'
                                        : 'text-gray-700'
                                    }`}
                                  >
                                    {key}.
                                  </span>
                                  <div
                                    className={`flex-1 ${question.correct_answer === key ? 'text-purple-600 font-medium' : 'text-gray-900'}`}
                                  >
                                    {optionData.text && (
                                      <div className="mb-1">
                                        {renderHtmlContent(optionData.text)}
                                      </div>
                                    )}
                                    {optionData.imageUrl && (
                                      <Image
                                        src={optionData.imageUrl}
                                        alt={`Option ${key}`}
                                        width={500}
                                        height={80}
                                        className="max-w-full h-auto max-h-20 border border-gray-200 rounded object-contain"
                                      />
                                    )}
                                  </div>
                                </div>
                              )
                            }
                          )
                        ) : (
                          <div className="text-center p-4 bg-gray-50 rounded border-2 border-dashed border-gray-300">
                            <p className="text-gray-600 text-sm">
                              No answer choices available for this question.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Correct Answer */}
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">
                      Correct Answer:
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(question.correct_answer) ? (
                        question.correct_answer.map((answer, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-purple-100 text-purple-800 rounded font-medium"
                          >
                            {answer}
                          </span>
                        ))
                      ) : (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded font-medium">
                          {question.correct_answer}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Explanation */}
                  {question.explanation && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-900 mb-2">
                        Explanation:
                      </h3>
                      <div className="p-3 bg-gray-50 rounded-md">
                        <div className="text-gray-900 leading-relaxed">
                          {renderHtmlContent(question.explanation || '')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Topic Tags */}
                  {question.topic_tags && question.topic_tags.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">
                        Topics:
                      </h3>
                      <div className="flex flex-wrap gap-1">
                        {question.topic_tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        )} {/* end fetchMode !== 'empty' guard */}

        {filteredQuestions.length === 0 && fetchMode !== 'empty' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-12 text-center">
            <p className="text-purple-600/70">
              No questions found matching your criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
