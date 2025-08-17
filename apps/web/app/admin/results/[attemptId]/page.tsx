'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../../contexts/auth-context'
import {
  AnalyticsService,
  type ComprehensiveResults,
} from '../../../../lib/analytics-service'
import { ExportService } from '../../../../lib/export-service'
import { ModuleType } from '../../../../lib/exam-service'
import { supabase } from '../../../../lib/supabase'

interface StudentProfile {
  id: string
  full_name: string
  email: string
  grade_level: number | null
  target_score: number | null
  created_at: string
}

interface ClassStats {
  totalStudents: number
  averageScore: number
  studentRank: number
  percentile: number
}

export default function AdminDetailedResultsPage() {
  const params = useParams()
  const { user } = useAuth()
  const [results, setResults] = useState<ComprehensiveResults | null>(null)
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [classStats, setClassStats] = useState<ClassStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<
    'overview' | 'questions' | 'comparison'
  >('overview')
  const [exporting, setExporting] = useState(false)
  const [questionFilter, setQuestionFilter] = useState<
    'all' | 'correct' | 'incorrect' | 'skipped'
  >('all')
  const [regrading, setRegrading] = useState<string | null>(null)
  const [regradeModal, setRegradeModal] = useState<{
    questionId: string
    userAnswerId: string
    currentCorrect: boolean
    questionNumber: number
  } | null>(null)
  const [regradeReason, setRegradeReason] = useState('')

  const attemptId = params.attemptId as string

  useEffect(() => {
    if (user && attemptId) {
      loadResults()
    }
  }, [user, attemptId])

  const loadResults = async () => {
    try {
      // Load comprehensive results
      const comprehensiveResults =
        await AnalyticsService.getComprehensiveResults(attemptId)
      setResults(comprehensiveResults)

      // Load student profile
      const { data: attemptData, error: attemptError } = await supabase
        .from('test_attempts')
        .select('user_id, exam_id')
        .eq('id', attemptId)
        .single()

      if (attemptError) throw attemptError

      const { data: studentData, error: studentError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', attemptData.user_id)
        .eq('role', 'student')
        .single()

      if (studentError) throw studentError
      setStudent(studentData)

      // Load class statistics if this is from an assigned exam
      if (attemptData.exam_id) {
        await loadClassStats(
          attemptData.exam_id,
          comprehensiveResults.detailedScore.totalScore
        )
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadClassStats = async (examId: string, studentScore: number) => {
    try {
      const { data: allAttempts, error } = await supabase
        .from('test_attempts')
        .select('total_score, final_scores')
        .eq('exam_id', examId)
        .eq('status', 'completed')

      if (error) throw error

      if (allAttempts && allAttempts.length > 0) {
        // Get display scores for all attempts
        const scores = allAttempts
          .map(
            (attempt) =>
              attempt.final_scores?.overall || attempt.total_score || 0
          )
          .filter((score) => score > 0)

        if (scores.length > 0) {
          const averageScore = Math.round(
            scores.reduce((sum, score) => sum + score, 0) / scores.length
          )
          const sortedScores = scores.sort((a, b) => b - a)
          const studentRank =
            sortedScores.findIndex((score) => score <= studentScore) + 1
          const percentile = Math.round(
            (1 - (studentRank - 1) / scores.length) * 100
          )

          setClassStats({
            totalStudents: scores.length,
            averageScore,
            studentRank,
            percentile,
          })
        }
      }
    } catch (err) {
      console.error('Failed to load class stats:', err)
    }
  }

  const handleExport = async () => {
    if (!results || !student) return

    setExporting(true)
    try {
      // Export detailed admin report
      await ExportService.exportStudentResults(attemptId)

      // Also download text report
      ExportService.downloadTextReport(results)
    } catch (err: any) {
      setError(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const handleRegradeQuestion = async () => {
    if (!regradeModal || !regradeReason.trim()) return

    setRegrading(regradeModal.userAnswerId)
    try {
      console.log('Starting regrade for question:', regradeModal.questionNumber)

      // Get fresh session and handle token refresh if needed
      let session = null
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession()
        
        // If no session or token is expired, try to refresh
        if (!currentSession || !currentSession.access_token) {
          console.log('No session or expired token, attempting refresh...')
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          if (refreshError) {
            console.error('Failed to refresh session:', refreshError)
            throw new Error('Authentication failed. Please refresh the page and try again.')
          }
          session = refreshData.session
        } else {
          session = currentSession
        }
        
        if (!session?.access_token) {
          throw new Error('No valid session found. Please refresh the page and try again.')
        }
      } catch (authError) {
        console.error('Authentication error:', authError)
        setError('Authentication failed. Please refresh the page and try again.')
        return
      }

      const requestBody = {
        userAnswerId: regradeModal.userAnswerId,
        newIsCorrect: !regradeModal.currentCorrect,
        reason: regradeReason.trim(),
      }

      console.log('Sending regrade request with body:', requestBody)

      const response = await fetch('/api/admin/regrade-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(requestBody),
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.log('Error response:', errorData)
        throw new Error(errorData.error || 'Failed to regrade question')
      }

      const result = await response.json()
      console.log('Regrade successful:', result)

      // Clear cache and force reload to get fresh data
      setResults(null)
      setClassStats(null)

      // Wait a moment for database replication
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Reload results to show updated scores
      await loadResults()

      setRegradeModal(null)
      setRegradeReason('')
      setError(null)
    } catch (err: any) {
      console.error('Regrade error:', err)
      setError(`Regrade failed: ${err.message}`)
    } finally {
      setRegrading(null)
    }
  }

  const openRegradeModal = (question: any) => {
    console.log('Opening regrade modal for question:', question)
    console.log('Question userAnswerId:', question.userAnswerId)

    setRegradeModal({
      questionId: question.questionId,
      userAnswerId: question.userAnswerId,
      currentCorrect: question.isCorrect,
      questionNumber: question.questionNumber,
    })
    setRegradeReason('')
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getModuleDisplayName = (moduleType: ModuleType) => {
    const names = {
      english1: 'Reading & Writing Module 1',
      english2: 'Reading & Writing Module 2',
      math1: 'Math Module 1 (No Calculator)',
      math2: 'Math Module 2 (Calculator)',
    }
    return names[moduleType]
  }

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-purple-600'
    if (percentage >= 70) return 'text-violet-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-purple-100 text-purple-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'hard':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getFilteredQuestions = () => {
    if (!results) return []

    return results.questionAnalysis.filter((question) => {
      switch (questionFilter) {
        case 'correct':
          return question.isCorrect
        case 'incorrect':
          return !question.isCorrect
        case 'skipped':
          return !question.userAnswer
        case 'all':
        default:
          return true
      }
    })
  }

  const getQuestionsGroupedByModule = () => {
    const filteredQuestions = getFilteredQuestions()

    const grouped = {
      english1: [] as typeof filteredQuestions,
      english2: [] as typeof filteredQuestions,
      math1: [] as typeof filteredQuestions,
      math2: [] as typeof filteredQuestions,
    }

    filteredQuestions.forEach((question) => {
      grouped[question.moduleType].push(question)
    })

    return grouped
  }

  if (loading) {
    return (
      <div className="h-full bg-gray-50">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading student results...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !results || !student) {
    return (
      <div className="h-full bg-gray-50">
        <div className="flex items-center justify-center h-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center max-w-md">
            <h3 className="text-lg font-medium text-red-900 mb-2">
              Error Loading Results
            </h3>
            <p className="text-red-700 mb-4">{error || 'Results not found'}</p>
            <Link
              href="/admin/students"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Students
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const {
    attempt,
    detailedScore,
    questionAnalysis,
    performanceAnalytics,
    progressComparison,
  } = results

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {student.full_name} - Test Results
            </h1>
            <p className="text-gray-600">
              Detailed performance analysis and question breakdown
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {exporting ? 'Exporting...' : 'Export Results'}
            </button>
            <Link
              href="/admin/students"
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              ← Back to Students
            </Link>
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
        {/* Student Context Info */}
        <div className="mb-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
            <div className="flex items-center space-x-6 text-sm text-gray-600 mb-3">
              <span>📧 {student.email}</span>
              <span>🎓 Grade: {student.grade_level || 'Not specified'}</span>
              <span>🎯 Target: {student.target_score || 'Not set'}</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-500">
              <span>
                📅{' '}
                {attempt.completed_at
                  ? formatDate(attempt.completed_at)
                  : 'In Progress'}
              </span>
              <span>
                ⏱️ Duration: {formatTime(performanceAnalytics.totalTimeSpent)}
              </span>
            </div>
          </div>
        </div>

        {/* Score Overview Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {detailedScore.totalScore}
              </div>
              <div className="text-sm text-gray-500">Total Score</div>
              <div className="text-xs text-gray-400">400-1600 scale</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-2">
                {detailedScore.evidenceBasedReading}
              </div>
              <div className="text-sm text-gray-500">
                Evidence-Based Reading and Writing
              </div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-2">
                {detailedScore.mathScore}
              </div>
              <div className="text-sm text-gray-500">Math</div>
            </div>
          </div>

          {/* Class Comparison */}
          {classStats && (
            <div className="pt-6 border-t border-purple-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Class Performance
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {classStats.studentRank} / {classStats.totalStudents}
                  </div>
                  <div className="text-sm text-gray-500">Class Rank</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-purple-600">
                    {classStats.percentile}th
                  </div>
                  <div className="text-sm text-gray-500">Percentile</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-orange-600">
                    {classStats.averageScore}
                  </div>
                  <div className="text-sm text-gray-500">Class Average</div>
                </div>
                <div>
                  <div
                    className={`text-lg font-semibold ${detailedScore.totalScore >= classStats.averageScore ? 'text-purple-600' : 'text-red-600'}`}
                  >
                    {detailedScore.totalScore >= classStats.averageScore
                      ? '+'
                      : ''}
                    {detailedScore.totalScore - classStats.averageScore}
                  </div>
                  <div className="text-sm text-gray-500">vs Average</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-2 mb-6">
          <nav className="flex space-x-2">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'questions', label: 'Questions' },
              { id: 'comparison', label: 'Comparison' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-6 rounded-xl font-medium text-sm transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Module Performance */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                📚 Module Performance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(detailedScore.rawScores).map(
                  ([module, score]) => {
                    const moduleType = module as ModuleType
                    const percentage = detailedScore.percentages[moduleType]
                    const percentile = detailedScore.percentiles[moduleType]

                    return (
                      <div key={module} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900">
                            {getModuleDisplayName(moduleType)}
                          </h4>
                          <span
                            className={`font-semibold ${getScoreColor(percentage)}`}
                          >
                            {Math.round(percentage)}%
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>Raw Score: {score}</div>
                          <div>Percentile: {percentile}th</div>
                        </div>
                        <div className="mt-2 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  }
                )}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Time Management */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">⏱️</span>
                  Time Management
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-bold text-violet-600">
                      {formatTime(
                        Math.round(performanceAnalytics.averageTimePerQuestion)
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      Avg per question
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    Total: {formatTime(performanceAnalytics.totalTimeSpent)}
                  </div>
                </div>
              </div>

              {/* Accuracy */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">🎯</span>
                  Accuracy
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round(performanceAnalytics.accuracyRate)}%
                    </div>
                    <div className="text-sm text-gray-500">
                      {performanceAnalytics.correctAnswers} of{' '}
                      {performanceAnalytics.totalQuestions}
                    </div>
                  </div>
                </div>
              </div>

              {/* Difficulty Performance */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">📈</span>
                  By Difficulty
                </h4>
                <div className="space-y-2 text-sm">
                  {Object.entries(performanceAnalytics.difficultyBreakdown).map(
                    ([difficulty, stats]) => (
                      <div key={difficulty} className="flex justify-between">
                        <span className="capitalize">{difficulty}:</span>
                        <span className={getScoreColor(stats.percentage)}>
                          {Math.round(stats.percentage)}%
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Strengths and Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                  ✅ Strength Areas
                </h4>
                {performanceAnalytics.strengthAreas.length > 0 ? (
                  <div className="space-y-2">
                    {performanceAnalytics.strengthAreas.map((area, index) => (
                      <div
                        key={index}
                        className="bg-purple-50 text-purple-800 px-3 py-2 rounded text-sm"
                      >
                        {area}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">
                    No strength areas identified (80%+ accuracy needed)
                  </p>
                )}
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                  ⚠️ Areas for Improvement
                </h4>
                {performanceAnalytics.weaknessAreas.length > 0 ? (
                  <div className="space-y-2">
                    {performanceAnalytics.weaknessAreas.map((area, index) => (
                      <div
                        key={index}
                        className="bg-red-50 text-red-800 px-3 py-2 rounded text-sm"
                      >
                        {area}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">
                    Great job! No major weak areas identified
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100">
            <div className="p-6 border-b border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  ❓ Question Analysis
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-black">Filter:</span>
                  <select
                    value={questionFilter}
                    onChange={(e) => setQuestionFilter(e.target.value as any)}
                    className="px-3 py-1 border border-purple-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Questions</option>
                    <option value="incorrect">Incorrect Only</option>
                    <option value="correct">Correct Only</option>
                    <option value="skipped">Skipped Only</option>
                  </select>
                </div>
              </div>
              <p className="text-black">
                Detailed analysis of each question with correct answers always
                shown (Admin View)
              </p>
            </div>

            <div className="p-6 space-y-8">
              {Object.entries(getQuestionsGroupedByModule()).map(
                ([moduleType, questions]) => {
                  if (questions.length === 0) return null

                  return (
                    <div
                      key={moduleType}
                      className="border-b border-purple-200 pb-6 last:border-b-0"
                    >
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <span className="w-3 h-3 bg-purple-500 rounded-full mr-2"></span>
                        {getModuleDisplayName(moduleType as ModuleType)}
                        <span className="ml-2 text-sm font-normal text-purple-600/70">
                          ({questions.length} question
                          {questions.length !== 1 ? 's' : ''})
                        </span>
                      </h4>

                      <div className="space-y-4">
                        {questions.map((question, index) => (
                          <div
                            key={question.questionId}
                            className={`border rounded-xl p-6 backdrop-blur-sm transition-all duration-300 ${
                              question.isCorrect
                                ? 'border-purple-200 bg-white/50 hover:bg-purple-50/30'
                                : 'border-red-200 bg-red-50/20 hover:bg-red-50/40'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center space-x-4">
                                <div className="flex-shrink-0">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium transition-all duration-300 ${
                                      question.isCorrect
                                        ? 'bg-purple-500 shadow-purple-200 shadow-lg'
                                        : 'bg-red-500 shadow-red-200 shadow-lg'
                                    }`}
                                  >
                                    {question.isCorrect ? '✓' : '✗'}
                                  </div>
                                </div>
                                <span className="px-2 py-1 bg-gradient-to-r from-purple-100 to-violet-100 text-purple-700 rounded text-sm font-medium">
                                  {getModuleDisplayName(
                                    moduleType as ModuleType
                                  ).replace('Module ', 'M')}{' '}
                                  - Q{question.questionNumber}
                                </span>
                                <span
                                  className={`px-2 py-1 rounded text-sm font-medium ${getDifficultyColor(question.difficulty)}`}
                                >
                                  {question.difficulty}
                                </span>
                                <span className="text-sm text-gray-500">
                                  Time: {formatTime(question.timeSpent)}
                                </span>
                              </div>

                              <div className="flex-shrink-0">
                                <button
                                  onClick={() => openRegradeModal(question)}
                                  disabled={
                                    regrading === question.userAnswerId ||
                                    !results
                                  }
                                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                    question.isCorrect
                                      ? 'bg-red-100 text-red-700 hover:bg-red-200 disabled:bg-red-50'
                                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:bg-purple-50'
                                  }`}
                                >
                                  {regrading === question.userAnswerId
                                    ? 'Regrading...'
                                    : !results
                                      ? 'Loading...'
                                      : question.isCorrect
                                        ? 'Mark Incorrect'
                                        : 'Mark Correct'}
                                </button>
                              </div>
                            </div>

                            {/* Question Content */}
                            <div className="mb-4">
                              <h3 className="font-medium text-gray-900 mb-2">
                                Question Text:
                              </h3>
                              <div className="p-3 bg-gray-50 rounded-md">
                                <div className="text-gray-900 leading-relaxed whitespace-pre-wrap">
                                  {question.questionText}
                                </div>

                                {question.questionImageUrl && (
                                  <div className="mt-3">
                                    <img
                                      src={question.questionImageUrl}
                                      alt="Question image"
                                      className="max-w-full h-auto rounded border"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Options for Multiple Choice */}
                            {question.options && (
                              <div className="mb-4">
                                <h3 className="font-medium text-gray-900 mb-2">
                                  Answer Options:
                                </h3>
                                <div className="space-y-2">
                                  {Object.entries(question.options).map(
                                    ([key, value]) => (
                                      <div
                                        key={key}
                                        className="flex items-start space-x-2"
                                      >
                                        <span
                                          className={`font-medium w-6 ${
                                            question.correctAnswer === key
                                              ? 'text-purple-600'
                                              : 'text-gray-700'
                                          }`}
                                        >
                                          {key}.
                                        </span>
                                        <div
                                          className={`flex-1 p-2 rounded ${
                                            question.userAnswer === key
                                              ? question.isCorrect
                                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                                : 'bg-red-100 text-red-800 border border-red-200'
                                              : question.correctAnswer === key
                                                ? 'bg-purple-100 text-purple-800 border border-purple-200 font-medium'
                                                : 'bg-gray-50 text-gray-900 border border-gray-200'
                                          }`}
                                        >
                                          {typeof value === 'string'
                                            ? value
                                            : typeof value === 'object' &&
                                                value !== null
                                              ? (value as any).text ||
                                                JSON.stringify(value)
                                              : String(value)}
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Answer Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                              <div>
                                <div className="text-gray-600 font-medium mb-1">
                                  Student Answer:
                                </div>
                                <div
                                  className={`px-2 py-1 rounded font-medium ${
                                    question.isCorrect
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {question.userAnswer || 'No answer'}
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-600 font-medium mb-1">
                                  Correct Answer
                                  {Array.isArray(question.correctAnswer) &&
                                  question.correctAnswer.length > 1
                                    ? 's'
                                    : ''}
                                  :
                                </div>
                                <div className="px-2 py-1 bg-purple-100 text-purple-800 rounded font-medium">
                                  {Array.isArray(question.correctAnswer)
                                    ? question.correctAnswer.join(', ')
                                    : question.correctAnswer}
                                </div>
                              </div>
                            </div>

                            {/* Topic Tags */}
                            {question.topicTags &&
                              question.topicTags.length > 0 && (
                                <div className="mb-4">
                                  <h3 className="font-medium text-gray-900 mb-2">
                                    Topics:
                                  </h3>
                                  <div className="flex flex-wrap gap-1">
                                    {question.topicTags.map((tag, tagIndex) => (
                                      <span
                                        key={tagIndex}
                                        className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                            {/* Explanation */}
                            {question.explanation && (
                              <div className="p-3 bg-purple-50 rounded">
                                <div className="text-sm font-medium text-gray-600 mb-1">
                                  Explanation:
                                </div>
                                <div className="text-sm text-gray-800 leading-relaxed">
                                  {question.explanation}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          </div>
        )}

        {activeTab === 'comparison' && (
          <div className="space-y-6">
            {/* Previous Attempts Comparison */}
            {progressComparison && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  📈 Progress Comparison
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-violet-600">
                      {progressComparison.previousAttempts}
                    </div>
                    <div className="text-sm text-gray-500">
                      Previous Attempts
                    </div>
                  </div>
                  <div className="text-center">
                    <div
                      className={`text-2xl font-bold ${progressComparison.scoreImprovement >= 0 ? 'text-purple-600' : 'text-red-600'}`}
                    >
                      {progressComparison.scoreImprovement >= 0 ? '+' : ''}
                      {progressComparison.scoreImprovement}
                    </div>
                    <div className="text-sm text-gray-500">Score Change</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round(detailedScore.percentages.overall)}%
                    </div>
                    <div className="text-sm text-gray-500">
                      Overall Accuracy
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Topic Performance Comparison */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
              <h4 className="font-medium text-gray-900 mb-4">
                📊 Topic Performance Breakdown
              </h4>
              <div className="space-y-3">
                {performanceAnalytics.topicPerformance.map((topic, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {topic.topic}
                        </span>
                        <span
                          className={`text-sm font-medium ${getScoreColor(topic.percentage)}`}
                        >
                          {Math.round(topic.percentage)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                        <span>
                          {topic.correct} of {topic.attempted} correct
                        </span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            topic.percentage >= 80
                              ? 'bg-purple-500'
                              : topic.percentage >= 60
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${topic.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Class Comparison Detail */}
            {classStats && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <h4 className="font-medium text-gray-900 mb-4">
                  👥 Class Performance Context
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                        <span className="text-sm font-medium">
                          Student Score:
                        </span>
                        <span className="text-lg font-bold text-purple-600">
                          {detailedScore.totalScore}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                        <span className="text-sm font-medium">
                          Class Average:
                        </span>
                        <span className="text-lg font-bold text-orange-600">
                          {classStats.averageScore}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                        <span className="text-sm font-medium">Difference:</span>
                        <span
                          className={`text-lg font-bold ${detailedScore.totalScore >= classStats.averageScore ? 'text-purple-600' : 'text-red-600'}`}
                        >
                          {detailedScore.totalScore >= classStats.averageScore
                            ? '+'
                            : ''}
                          {detailedScore.totalScore - classStats.averageScore}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span className="text-sm font-medium">Class Rank:</span>
                        <span className="text-lg font-bold text-gray-700">
                          {classStats.studentRank} / {classStats.totalStudents}
                        </span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                        <span className="text-sm font-medium">Percentile:</span>
                        <span className="text-lg font-bold text-purple-600">
                          {classStats.percentile}th
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Regrade Confirmation Modal */}
      {regradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Regrade Question {regradeModal.questionNumber}
            </h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Current status:{' '}
                <span
                  className={`font-medium ${regradeModal.currentCorrect ? 'text-purple-600' : 'text-red-600'}`}
                >
                  {regradeModal.currentCorrect ? 'Correct' : 'Incorrect'}
                </span>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                New status:{' '}
                <span
                  className={`font-medium ${!regradeModal.currentCorrect ? 'text-purple-600' : 'text-red-600'}`}
                >
                  {!regradeModal.currentCorrect ? 'Correct' : 'Incorrect'}
                </span>
              </p>
            </div>

            <div className="mb-4">
              <label
                htmlFor="regrade-reason"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Reason for regrading (required):
              </label>
              <textarea
                id="regrade-reason"
                rows={3}
                value={regradeReason}
                onChange={(e) => setRegradeReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Explain why this question needs to be regraded..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setRegradeModal(null)
                  setRegradeReason('')
                }}
                disabled={regrading !== null}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRegradeQuestion}
                disabled={!regradeReason.trim() || regrading !== null}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-300 transition-colors"
              >
                {regrading !== null ? 'Regrading...' : 'Confirm Regrade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
