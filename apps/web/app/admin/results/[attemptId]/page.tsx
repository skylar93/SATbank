'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../../contexts/auth-context'
import { Navigation } from '../../../../components/navigation'
import { AnalyticsService, type ComprehensiveResults } from '../../../../lib/analytics-service'
import { ExportService } from '../../../../lib/export-service'
import { ModuleType, ExamService } from '../../../../lib/exam-service'
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
  const router = useRouter()
  const { user } = useAuth()
  const [results, setResults] = useState<ComprehensiveResults | null>(null)
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [classStats, setClassStats] = useState<ClassStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'comparison'>('overview')
  const [exporting, setExporting] = useState(false)
  const [questionFilter, setQuestionFilter] = useState<'all' | 'correct' | 'incorrect' | 'skipped'>('all')

  const attemptId = params.attemptId as string

  useEffect(() => {
    if (user && attemptId) {
      loadResults()
    }
  }, [user, attemptId])

  const loadResults = async () => {
    try {
      // Load comprehensive results
      const comprehensiveResults = await AnalyticsService.getComprehensiveResults(attemptId)
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
        await loadClassStats(attemptData.exam_id, comprehensiveResults.detailedScore.totalScore)
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
        const scores = allAttempts.map(attempt => 
          attempt.final_scores?.overall || attempt.total_score || 0
        ).filter(score => score > 0)

        if (scores.length > 0) {
          const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          const sortedScores = scores.sort((a, b) => b - a)
          const studentRank = sortedScores.findIndex(score => score <= studentScore) + 1
          const percentile = Math.round((1 - (studentRank - 1) / scores.length) * 100)

          setClassStats({
            totalStudents: scores.length,
            averageScore,
            studentRank,
            percentile
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
      minute: '2-digit'
    })
  }

  const getModuleDisplayName = (moduleType: ModuleType) => {
    const names = {
      english1: 'Reading & Writing Module 1',
      english2: 'Reading & Writing Module 2', 
      math1: 'Math Module 1 (No Calculator)',
      math2: 'Math Module 2 (Calculator)'
    }
    return names[moduleType]
  }

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 70) return 'text-blue-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getFilteredQuestions = () => {
    if (!results) return []
    
    return results.questionAnalysis.filter(question => {
      switch (questionFilter) {
        case 'correct': return question.isCorrect
        case 'incorrect': return !question.isCorrect
        case 'skipped': return !question.userAnswer
        case 'all':
        default: return true
      }
    })
  }

  const getQuestionsGroupedByModule = () => {
    const filteredQuestions = getFilteredQuestions()
    
    const grouped = {
      english1: [] as typeof filteredQuestions,
      english2: [] as typeof filteredQuestions,
      math1: [] as typeof filteredQuestions,
      math2: [] as typeof filteredQuestions
    }
    
    filteredQuestions.forEach(question => {
      grouped[question.moduleType].push(question)
    })
    
    return grouped
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading student results...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !results || !student) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Results</h3>
            <p className="text-red-700 mb-4">{error || 'Results not found'}</p>
            <Link
              href="/admin/students"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Students
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { attempt, detailedScore, questionAnalysis, performanceAnalytics, progressComparison } = results

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header Section - Student Context */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {student.full_name} - Test Results
              </h1>
              <div className="flex items-center space-x-6 text-sm text-gray-600">
                <span>📧 {student.email}</span>
                <span>🎓 Grade: {student.grade_level || 'Not specified'}</span>
                <span>🎯 Target: {student.target_score || 'Not set'}</span>
              </div>
              <div className="flex items-center space-x-6 text-sm text-gray-500 mt-2">
                <span>📅 {attempt.completed_at ? formatDate(attempt.completed_at) : 'In Progress'}</span>
                <span>⏱️ Duration: {formatTime(performanceAnalytics.totalTimeSpent)}</span>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleExport}
                disabled={exporting}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {exporting ? 'Exporting...' : 'Export Results'}
              </button>
              <Link
                href="/admin/students"
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                ← Back to Students
              </Link>
            </div>
          </div>
        </div>

        {/* Score Overview Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {detailedScore.totalScore}
              </div>
              <div className="text-sm text-gray-500">Total Score</div>
              <div className="text-xs text-gray-400">400-1600 scale</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {detailedScore.evidenceBasedReading}
              </div>
              <div className="text-sm text-gray-500">Evidence-Based Reading and Writing</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">
                {detailedScore.mathScore}
              </div>
              <div className="text-sm text-gray-500">Math</div>
            </div>
          </div>

          {/* Class Comparison */}
          {classStats && (
            <div className="pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Class Performance</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {classStats.studentRank} / {classStats.totalStudents}
                  </div>
                  <div className="text-sm text-gray-500">Class Rank</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-blue-600">
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
                  <div className={`text-lg font-semibold ${detailedScore.totalScore >= classStats.averageScore ? 'text-green-600' : 'text-red-600'}`}>
                    {detailedScore.totalScore >= classStats.averageScore ? '+' : ''}{detailedScore.totalScore - classStats.averageScore}
                  </div>
                  <div className="text-sm text-gray-500">vs Average</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'questions', label: 'Questions', icon: '❓' },
              { id: 'comparison', label: 'Comparison', icon: '📈' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Module Performance */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 Module Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(detailedScore.rawScores).map(([module, score]) => {
                  const moduleType = module as ModuleType
                  const percentage = detailedScore.percentages[moduleType]
                  const percentile = detailedScore.percentiles[moduleType]
                  
                  return (
                    <div key={module} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">
                          {getModuleDisplayName(moduleType)}
                        </h4>
                        <span className={`font-semibold ${getScoreColor(percentage)}`}>
                          {Math.round(percentage)}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Raw Score: {score}</div>
                        <div>Percentile: {percentile}th</div>
                      </div>
                      <div className="mt-2 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Time Management */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">⏱️</span>
                  Time Management
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatTime(Math.round(performanceAnalytics.averageTimePerQuestion))}
                    </div>
                    <div className="text-sm text-gray-500">Avg per question</div>
                  </div>
                  <div className="text-xs text-gray-400">
                    Total: {formatTime(performanceAnalytics.totalTimeSpent)}
                  </div>
                </div>
              </div>

              {/* Accuracy */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">🎯</span>
                  Accuracy
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {Math.round(performanceAnalytics.accuracyRate)}%
                    </div>
                    <div className="text-sm text-gray-500">
                      {performanceAnalytics.correctAnswers} of {performanceAnalytics.totalQuestions}
                    </div>
                  </div>
                </div>
              </div>

              {/* Difficulty Performance */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">📈</span>
                  By Difficulty
                </h4>
                <div className="space-y-2 text-sm">
                  {Object.entries(performanceAnalytics.difficultyBreakdown).map(([difficulty, stats]) => (
                    <div key={difficulty} className="flex justify-between">
                      <span className="capitalize">{difficulty}:</span>
                      <span className={getScoreColor(stats.percentage)}>
                        {Math.round(stats.percentage)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Strengths and Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  ✅ Strength Areas
                </h4>
                {performanceAnalytics.strengthAreas.length > 0 ? (
                  <div className="space-y-2">
                    {performanceAnalytics.strengthAreas.map((area, index) => (
                      <div key={index} className="bg-green-50 text-green-800 px-3 py-2 rounded text-sm">
                        {area}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No strength areas identified (80%+ accuracy needed)</p>
                )}
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                  ⚠️ Areas for Improvement
                </h4>
                {performanceAnalytics.weaknessAreas.length > 0 ? (
                  <div className="space-y-2">
                    {performanceAnalytics.weaknessAreas.map((area, index) => (
                      <div key={index} className="bg-red-50 text-red-800 px-3 py-2 rounded text-sm">
                        {area}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Great job! No major weak areas identified</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">❓ Question Analysis</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Filter:</span>
                  <select
                    value={questionFilter}
                    onChange={(e) => setQuestionFilter(e.target.value as any)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Questions</option>
                    <option value="incorrect">❌ Incorrect Only</option>
                    <option value="correct">✅ Correct Only</option>
                    <option value="skipped">⚪ Skipped Only</option>
                  </select>
                </div>
              </div>
              <p className="text-gray-600">
                Detailed analysis of each question with correct answers always shown (Admin View)
              </p>
            </div>
            
            <div className="space-y-8">
              {Object.entries(getQuestionsGroupedByModule()).map(([moduleType, questions]) => {
                if (questions.length === 0) return null
                
                return (
                  <div key={moduleType} className="border-b border-gray-200 pb-6 last:border-b-0">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                      {getModuleDisplayName(moduleType as ModuleType)}
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({questions.length} question{questions.length !== 1 ? 's' : ''})
                      </span>
                    </h4>
                    
                    <div className="space-y-6">
                      {questions.map((question, index) => (
                        <div key={question.questionId} className="bg-gray-50 rounded-lg p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                                  question.isCorrect ? 'bg-green-500' : 'bg-red-500'
                                }`}>
                                  {question.isCorrect ? '✓' : '✗'}
                                </div>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  Q{question.questionNumber}
                                </div>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                                    {question.difficulty}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    Time: {formatTime(question.timeSpent)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Question Content */}
                          <div className="mb-4 p-4 bg-white rounded border">
                            <div className="text-sm text-gray-600 mb-2 font-medium">Question:</div>
                            <div className="text-sm text-gray-900 mb-3 whitespace-pre-wrap">
                              {question.questionText}
                            </div>
                            
                            {question.questionImageUrl && (
                              <div className="mb-3">
                                <img 
                                  src={question.questionImageUrl} 
                                  alt="Question image" 
                                  className="max-w-full h-auto rounded border"
                                />
                              </div>
                            )}
                            
                            {question.options && (
                              <div className="space-y-1">
                                <div className="text-sm text-gray-600 font-medium">Options:</div>
                                {Object.entries(question.options).map(([key, value]) => (
                                  <div 
                                    key={key} 
                                    className={`text-sm p-2 rounded ${
                                      question.userAnswer === key 
                                        ? (question.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
                                        : question.correctAnswer === key 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-gray-100'
                                    }`}
                                  >
                                    <span className="font-medium">{key}.</span> {value}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-3">
                            <div>
                              <div className="text-gray-600">Student Answer:</div>
                              <div className={`font-medium ${question.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                {question.userAnswer || 'No answer'}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-600">Correct Answer{Array.isArray(question.correctAnswer) && question.correctAnswer.length > 1 ? 's' : ''}:</div>
                              <div className="font-medium text-green-600">
                                {Array.isArray(question.correctAnswer) 
                                  ? question.correctAnswer.join(', ')
                                  : question.correctAnswer
                                }
                              </div>
                            </div>
                          </div>

                          {question.topicTags && question.topicTags.length > 0 && (
                            <div className="mb-3">
                              <div className="text-sm text-gray-600 mb-1">Topics:</div>
                              <div className="flex flex-wrap gap-1">
                                {question.topicTags.map((tag, tagIndex) => (
                                  <span key={tagIndex} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {question.explanation && (
                            <div className="p-3 bg-blue-50 rounded">
                              <div className="text-sm text-gray-600 mb-1">Explanation:</div>
                              <div className="text-sm text-gray-800">{question.explanation}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'comparison' && (
          <div className="space-y-6">
            {/* Previous Attempts Comparison */}
            {progressComparison && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Progress Comparison</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {progressComparison.previousAttempts}
                    </div>
                    <div className="text-sm text-gray-500">Previous Attempts</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${progressComparison.scoreImprovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {progressComparison.scoreImprovement >= 0 ? '+' : ''}{progressComparison.scoreImprovement}
                    </div>
                    <div className="text-sm text-gray-500">Score Change</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round(detailedScore.percentages.overall)}%
                    </div>
                    <div className="text-sm text-gray-500">Overall Accuracy</div>
                  </div>
                </div>
              </div>
            )}

            {/* Topic Performance Comparison */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h4 className="font-medium text-gray-900 mb-4">📊 Topic Performance Breakdown</h4>
              <div className="space-y-3">
                {performanceAnalytics.topicPerformance.map((topic, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-900">{topic.topic}</span>
                        <span className={`text-sm font-medium ${getScoreColor(topic.percentage)}`}>
                          {Math.round(topic.percentage)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                        <span>{topic.correct} of {topic.attempted} correct</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            topic.percentage >= 80 ? 'bg-green-500' :
                            topic.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-4">👥 Class Performance Context</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                        <span className="text-sm font-medium">Student Score:</span>
                        <span className="text-lg font-bold text-blue-600">{detailedScore.totalScore}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                        <span className="text-sm font-medium">Class Average:</span>
                        <span className="text-lg font-bold text-orange-600">{classStats.averageScore}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                        <span className="text-sm font-medium">Difference:</span>
                        <span className={`text-lg font-bold ${detailedScore.totalScore >= classStats.averageScore ? 'text-green-600' : 'text-red-600'}`}>
                          {detailedScore.totalScore >= classStats.averageScore ? '+' : ''}{detailedScore.totalScore - classStats.averageScore}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span className="text-sm font-medium">Class Rank:</span>
                        <span className="text-lg font-bold text-gray-700">{classStats.studentRank} / {classStats.totalStudents}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                        <span className="text-sm font-medium">Percentile:</span>
                        <span className="text-lg font-bold text-green-600">{classStats.percentile}th</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}