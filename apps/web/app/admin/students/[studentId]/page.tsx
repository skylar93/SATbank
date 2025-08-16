'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../../contexts/auth-context'
import { AnalyticsService, type ComprehensiveResults } from '../../../../lib/analytics-service'
import { ExportService } from '../../../../lib/export-service'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface StudentProfile {
  id: string
  full_name: string
  email: string
  grade_level: number | null
  target_score: number | null
  created_at: string
}

interface TestAttemptSummary {
  id: string
  created_at: string
  completed_at: string
  total_score: number
  module_scores: any
  time_spent: any
  status: string
  final_scores?: {
    overall: number
    [key: string]: any
  }
  exam?: {
    id: string
    title: string
  }
}

export default function StudentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [student, setStudent] = useState<StudentProfile | null>(null)
  const [attempts, setAttempts] = useState<TestAttemptSummary[]>([])
  const [selectedAttempt, setSelectedAttempt] = useState<ComprehensiveResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'attempts' | 'progress'>('overview')

  const studentId = params.studentId as string

  useEffect(() => {
    if (user && studentId) {
      loadStudentData()
    }
  }, [user, studentId])

  const loadStudentData = async () => {
    try {
      // Load student profile
      const { data: studentData, error: studentError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', studentId)
        .eq('role', 'student')
        .single()

      if (studentError) throw studentError
      if (!studentData) throw new Error('Student not found')

      setStudent(studentData)

      // Load all test attempts with exam info
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('test_attempts')
        .select(`
          *,
          exam:exams (
            id,
            title
          )
        `)
        .eq('user_id', studentId)
        .order('created_at', { ascending: false })

      if (attemptsError) throw attemptsError
      setAttempts(attemptsData || [])

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadAttemptDetails = async (attemptId: string) => {
    setDetailsLoading(true)
    try {
      const results = await AnalyticsService.getComprehensiveResults(attemptId)
      setSelectedAttempt(results)
    } catch (err: any) {
      setError(`Failed to load attempt details: ${err.message}`)
    } finally {
      setDetailsLoading(false)
    }
  }

  const exportStudentData = async () => {
    if (!student) return
    
    try {
      const csvContent = ExportService.exportAdminDataToCSV(
        attempts.map(attempt => ({
          student_name: student.full_name,
          email: student.email,
          grade_level: student.grade_level,
          target_score: student.target_score,
          ...attempt,
          user_profiles: {
            full_name: student.full_name,
            email: student.email
          }
        }))
      )
      
      ExportService.downloadCSV(
        csvContent, 
        `student-${student.full_name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`
      )
    } catch (err: any) {
      setError(`Export failed: ${err.message}`)
    }
  }

  // Helper function to get display score (consistent with analytics service)
  const getDisplayScore = (attempt: TestAttemptSummary): number => {
    return attempt.final_scores?.overall || attempt.total_score || 0
  }

  const calculateStats = () => {
    const completedAttempts = attempts.filter(a => a.status === 'completed')
    const scores = completedAttempts.map(a => getDisplayScore(a)).filter(Boolean)
    
    return {
      totalAttempts: attempts.length,
      completedAttempts: completedAttempts.length,
      averageScore: scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
      bestScore: scores.length > 0 ? Math.max(...scores) : 0,
      latestScore: scores.length > 0 ? scores[0] : 0,
      improvement: scores.length >= 2 ? scores[0] - scores[scores.length - 1] : 0
    }
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

  const getScoreColor = (score: number) => {
    if (score >= 1200) return 'text-purple-600'
    if (score >= 1000) return 'text-blue-600'
    if (score >= 800) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-purple-100 text-purple-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'expired': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="h-full bg-gray-50">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading student data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className="h-full bg-gray-50">
        <div className="flex items-center justify-center h-full">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center max-w-md">
            <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Student</h3>
            <p className="text-red-700 mb-4">{error || 'Student not found'}</p>
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

  const stats = calculateStats()

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {student.full_name}
            </h1>
            <p className="text-gray-600">Student performance overview and test history</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={exportStudentData}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Export Data
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
        {/* Student Info */}
        <div className="mb-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
            <div className="flex items-center space-x-6 text-sm text-gray-600 mb-3">
              <span>📧 {student.email}</span>
              <span>🎓 Grade: {student.grade_level || 'Not specified'}</span>
              <span>🎯 Target Score: {student.target_score || 'Not set'}</span>
            </div>
            <div className="text-sm text-gray-500">
              <span>Member since: {formatDate(student.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-5">
            <div className="text-2xl font-bold text-gray-700 mb-1">{stats.totalAttempts}</div>
            <div className="text-sm text-gray-500">Total Attempts</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-5">
            <div className="text-2xl font-bold text-purple-600 mb-1">{stats.completedAttempts}</div>
            <div className="text-sm text-gray-500">Completed</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-5">
            <div className={`text-2xl font-bold mb-1 ${getScoreColor(stats.latestScore)}`}>
              {stats.latestScore || 'N/A'}
            </div>
            <div className="text-sm text-gray-500">Latest Score</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-5">
            <div className={`text-2xl font-bold mb-1 ${getScoreColor(stats.bestScore)}`}>
              {stats.bestScore || 'N/A'}
            </div>
            <div className="text-sm text-gray-500">Best Score</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-5">
            <div className="text-2xl font-bold text-gray-700 mb-1">{stats.averageScore || 'N/A'}</div>
            <div className="text-sm text-gray-500">Average Score</div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-5">
            <div className={`text-2xl font-bold mb-1 ${stats.improvement >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {stats.improvement > 0 ? '+' : ''}{stats.improvement || 'N/A'}
            </div>
            <div className="text-sm text-gray-500">Improvement</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-2 mb-8">
          <nav className="flex space-x-2">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'attempts', label: 'Test Attempts' },
              { id: 'progress', label: 'Progress Tracking' }
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
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Recent Performance */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Performance</h3>
              {attempts.filter(a => a.status === 'completed').slice(0, 3).map((attempt, index) => {
                const displayScore = getDisplayScore(attempt)
                return (
                  <div key={attempt.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                    <div>
                      <div className="font-medium text-gray-900">
                        {attempt.exam?.title || 'SAT Mock Exam'} - {formatDate(attempt.completed_at)}
                      </div>
                      <div className="text-sm text-gray-500">
                        Duration: {attempt.created_at ? Math.round((new Date(attempt.completed_at).getTime() - new Date(attempt.created_at).getTime()) / (1000 * 60)) : 'N/A'} minutes
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getScoreColor(displayScore)}`}>
                        {displayScore}
                      </div>
                      <button
                        onClick={() => loadAttemptDetails(attempt.id)}
                        className="text-sm text-purple-600 hover:text-purple-700"
                        disabled={detailsLoading}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                )
              })}
              {attempts.filter(a => a.status === 'completed').length === 0 && (
                <p className="text-gray-500 text-center py-4">No completed tests yet</p>
              )}
            </div>

            {/* Performance Summary */}
            {selectedAttempt && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Latest Test Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Module Scores</h4>
                    <div className="space-y-2">
                      {Object.entries(selectedAttempt.detailedScore.rawScores).map(([module, score]) => (
                        <div key={module} className="flex justify-between">
                          <span className="text-sm text-gray-600 capitalize">
                            {module.replace(/(\d)/g, ' $1')}:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {score} ({Math.round(selectedAttempt.detailedScore.percentages[module as keyof typeof selectedAttempt.detailedScore.percentages])}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Strengths & Weaknesses</h4>
                    <div className="space-y-3">
                      {selectedAttempt.performanceAnalytics.strengthAreas.length > 0 && (
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Strengths:</div>
                          <div className="flex flex-wrap gap-1">
                            {selectedAttempt.performanceAnalytics.strengthAreas.slice(0, 3).map((area, idx) => (
                              <span key={idx} className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs">
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedAttempt.performanceAnalytics.weaknessAreas.length > 0 && (
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Areas for improvement:</div>
                          <div className="flex flex-wrap gap-1">
                            {selectedAttempt.performanceAnalytics.weaknessAreas.slice(0, 3).map((area, idx) => (
                              <span key={idx} className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs">
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'attempts' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100">
            <div className="p-6 border-b border-purple-200">
              <h3 className="text-lg font-semibold text-slate-800">All Test Attempts</h3>
              <p className="text-slate-600 mt-1">Complete history of student test attempts</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exam
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Module Scores
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attempts.map((attempt) => {
                    const displayScore = getDisplayScore(attempt)
                    return (
                      <tr key={attempt.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {attempt.exam?.title || 'SAT Mock Exam'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {attempt.completed_at ? formatDate(attempt.completed_at) : 'In Progress'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-2 text-xs font-semibold rounded-full ${getStatusColor(attempt.status)}`}>
                            {attempt.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {attempt.status === 'completed' ? (
                            <div className={`text-sm font-medium ${getScoreColor(displayScore)}`}>
                              {displayScore}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {attempt.module_scores && Object.keys(attempt.module_scores).length > 0 ? (
                            <div className="text-xs">
                              {Object.entries(attempt.module_scores).map(([module, score]) => (
                                <div key={module}>{module}: {String(score)}</div>
                              ))}
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {attempt.status === 'completed' && (
                            <Link
                              href={`/admin/results/${attempt.id}`}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            >
                              View Results
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {attempts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No test attempts yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="space-y-6">
            {/* Score Progression Chart (Simplified) */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Score Progression</h3>
              <div className="space-y-4">
                {attempts
                  .filter(a => a.status === 'completed')
                  .reverse()
                  .map((attempt, index, array) => {
                    const displayScore = getDisplayScore(attempt)
                    const prevDisplayScore = index > 0 ? getDisplayScore(array[index - 1]) : 0
                    const improvement = index > 0 ? displayScore - prevDisplayScore : 0
                    return (
                      <div key={attempt.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                        <div>
                          <div className="text-sm font-medium text-slate-800">
                            {attempt.exam?.title || `Test #${index + 1}`}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatDate(attempt.completed_at)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${getScoreColor(displayScore)}`}>
                            {displayScore}
                          </div>
                          {improvement !== 0 && (
                            <div className={`text-xs font-medium px-2 py-1 rounded ${improvement > 0 ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100'}`}>
                              {improvement > 0 ? '+' : ''}{improvement}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
              {attempts.filter(a => a.status === 'completed').length === 0 && (
                <p className="text-gray-500 text-center py-4">No completed tests to show progression</p>
              )}
            </div>

            {/* Goal Tracking */}
            {student.target_score && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Goal Progress</h3>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Target Score:</span>
                  <span className="text-sm font-medium text-gray-900">{student.target_score}</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">Current Best:</span>
                  <span className={`text-sm font-medium ${getScoreColor(stats.bestScore)}`}>
                    {stats.bestScore || 0}
                  </span>
                </div>
                <div className="bg-slate-200 rounded-full h-4 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min((stats.bestScore / student.target_score) * 100, 100)}%` 
                    }}
                  ></div>
                </div>
                <div className="mt-2 text-center">
                  <span className="text-sm text-gray-600">
                    {Math.round((stats.bestScore / student.target_score) * 100)}% of target achieved
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}