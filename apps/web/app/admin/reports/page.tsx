'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { ExportService } from '../../../lib/export-service'
import { supabase } from '../../../lib/supabase'

interface SystemAnalytics {
  totalStudents: number
  totalAttempts: number
  completedAttempts: number
  averageScore: number
  scoreDistribution: {
    excellent: number // 1200+
    good: number      // 1000-1199
    fair: number      // 800-999
    poor: number      // <800
  }
  modulePerformance: {
    english1: { avg: number; attempts: number }
    english2: { avg: number; attempts: number }
    math1: { avg: number; attempts: number }
    math2: { avg: number; attempts: number }
  }
  difficultyAnalysis: {
    easy: { attempted: number; correct: number; percentage: number }
    medium: { attempted: number; correct: number; percentage: number }
    hard: { attempted: number; correct: number; percentage: number }
  }
  topicPerformance: Array<{
    topic: string
    attempted: number
    correct: number
    percentage: number
  }>
  timeAnalysis: {
    averageTestDuration: number
    fastestCompletion: number
    slowestCompletion: number
    timeByModule: {
      english1: number
      english2: number
      math1: number
      math2: number
    }
  }
  trends: {
    daily: Array<{ date: string; completions: number; avgScore: number }>
    weekly: Array<{ week: string; completions: number; avgScore: number }>
    monthly: Array<{ month: string; completions: number; avgScore: number }>
  }
}

export default function AdminReportsPage() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month')
  const [activeReport, setActiveReport] = useState<'overview' | 'performance' | 'trends' | 'topics'>('overview')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (user) {
      loadAnalytics()
    }
  }, [user, dateRange])

  const getDateFilter = () => {
    const now = new Date()
    const ranges = {
      week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      quarter: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      year: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    }
    return ranges[dateRange].toISOString()
  }

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const dateFilter = getDateFilter()

      // Load basic metrics
      const [studentsResult, attemptsResult, completedResult] = await Promise.all([
        supabase.from('user_profiles').select('id').eq('role', 'student'),
        supabase.from('test_attempts').select('*').gte('created_at', dateFilter),
        supabase.from('test_attempts').select('*').eq('status', 'completed').gte('completed_at', dateFilter)
      ])

      if (studentsResult.error) throw studentsResult.error
      if (attemptsResult.error) throw attemptsResult.error
      if (completedResult.error) throw completedResult.error

      const students = studentsResult.data || []
      const attempts = attemptsResult.data || []
      const completedAttempts = completedResult.data || []

      // Calculate score distribution
      const scores = completedAttempts.map(a => a.total_score).filter(Boolean)
      const scoreDistribution = {
        excellent: scores.filter(s => s >= 1200).length,
        good: scores.filter(s => s >= 1000 && s < 1200).length,
        fair: scores.filter(s => s >= 800 && s < 1000).length,
        poor: scores.filter(s => s < 800).length
      }

      // Calculate module performance
      const moduleScores = completedAttempts.reduce((acc, attempt) => {
        if (attempt.module_scores) {
          Object.entries(attempt.module_scores).forEach(([module, score]) => {
            if (!acc[module]) acc[module] = { total: 0, count: 0 }
            acc[module].total += score as number
            acc[module].count += 1
          })
        }
        return acc
      }, {} as Record<string, { total: number; count: number }>)

      const modulePerformance = {
        english1: {
          avg: moduleScores.english1 ? Math.round(moduleScores.english1.total / moduleScores.english1.count) : 0,
          attempts: moduleScores.english1?.count || 0
        },
        english2: {
          avg: moduleScores.english2 ? Math.round(moduleScores.english2.total / moduleScores.english2.count) : 0,
          attempts: moduleScores.english2?.count || 0
        },
        math1: {
          avg: moduleScores.math1 ? Math.round(moduleScores.math1.total / moduleScores.math1.count) : 0,
          attempts: moduleScores.math1?.count || 0
        },
        math2: {
          avg: moduleScores.math2 ? Math.round(moduleScores.math2.total / moduleScores.math2.count) : 0,
          attempts: moduleScores.math2?.count || 0
        }
      }

      // Load difficulty and topic analysis from user answers
      const { data: answersData } = await supabase
        .from('user_answers')
        .select(`
          *,
          questions:question_id (difficulty_level, topic_tags),
          test_attempts:attempt_id (completed_at)
        `)
        .not('test_attempts.completed_at', 'is', null)
        .gte('test_attempts.completed_at', dateFilter)

      const difficultyStats = {
        easy: { attempted: 0, correct: 0, percentage: 0 },
        medium: { attempted: 0, correct: 0, percentage: 0 },
        hard: { attempted: 0, correct: 0, percentage: 0 }
      }

      const topicStats: Record<string, { attempted: number; correct: number }> = {}

      answersData?.forEach(answer => {
        const question = answer.questions
        if (question) {
          // Difficulty analysis
          const difficulty = question.difficulty_level
          if (difficultyStats[difficulty as keyof typeof difficultyStats]) {
            difficultyStats[difficulty as keyof typeof difficultyStats].attempted++
            if (answer.is_correct) {
              difficultyStats[difficulty as keyof typeof difficultyStats].correct++
            }
          }

          // Topic analysis
          if (question.topic_tags) {
            question.topic_tags.forEach((topic: string) => {
              if (!topicStats[topic]) {
                topicStats[topic] = { attempted: 0, correct: 0 }
              }
              topicStats[topic].attempted++
              if (answer.is_correct) {
                topicStats[topic].correct++
              }
            })
          }
        }
      })

      // Calculate percentages for difficulty
      Object.keys(difficultyStats).forEach(key => {
        const diff = difficultyStats[key as keyof typeof difficultyStats]
        diff.percentage = diff.attempted > 0 ? (diff.correct / diff.attempted) * 100 : 0
      })

      const topicPerformance = Object.entries(topicStats)
        .map(([topic, stats]) => ({
          topic,
          attempted: stats.attempted,
          correct: stats.correct,
          percentage: stats.attempted > 0 ? (stats.correct / stats.attempted) * 100 : 0
        }))
        .sort((a, b) => b.attempted - a.attempted)
        .slice(0, 10)

      // Time analysis
      const durations = completedAttempts
        .filter(a => a.started_at && a.completed_at)
        .map(a => {
          const start = new Date(a.started_at).getTime()
          const end = new Date(a.completed_at).getTime()
          return (end - start) / (1000 * 60) // minutes
        })

      const timeAnalysis = {
        averageTestDuration: durations.length > 0 ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : 0,
        fastestCompletion: durations.length > 0 ? Math.round(Math.min(...durations)) : 0,
        slowestCompletion: durations.length > 0 ? Math.round(Math.max(...durations)) : 0,
        timeByModule: {
          english1: 32, // Default expected times
          english2: 32,
          math1: 35,
          math2: 35
        }
      }

      // Trends analysis (simplified - daily for last 7 days)
      const dailyTrends = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        
        const dayAttempts = completedAttempts.filter(a => 
          a.completed_at.startsWith(dateStr)
        )
        
        dailyTrends.push({
          date: dateStr,
          completions: dayAttempts.length,
          avgScore: dayAttempts.length > 0 
            ? Math.round(dayAttempts.reduce((sum, a) => sum + (a.total_score || 0), 0) / dayAttempts.length)
            : 0
        })
      }

      const analyticsData: SystemAnalytics = {
        totalStudents: students.length,
        totalAttempts: attempts.length,
        completedAttempts: completedAttempts.length,
        averageScore: scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : 0,
        scoreDistribution,
        modulePerformance,
        difficultyAnalysis: difficultyStats,
        topicPerformance,
        timeAnalysis,
        trends: {
          daily: dailyTrends,
          weekly: [], // Could be implemented
          monthly: [] // Could be implemented
        }
      }

      setAnalytics(analyticsData)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const exportReport = async (type: 'summary' | 'detailed') => {
    if (!analytics) return
    
    setExporting(true)
    try {
      if (type === 'summary') {
        // Generate summary report
        const reportData = {
          reportType: 'System Analytics Summary',
          dateRange,
          generatedAt: new Date().toISOString(),
          ...analytics
        }
        
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `system-report-${dateRange}-${new Date().toISOString().split('T')[0]}.json`
        link.click()
        URL.revokeObjectURL(url)
      } else {
        // Generate detailed CSV with all student data
        const { data: detailedData } = await supabase
          .from('test_attempts')
          .select(`
            *,
            user_profiles:user_id (full_name, email, grade_level, target_score)
          `)
          .eq('status', 'completed')
          .gte('completed_at', getDateFilter())

        const csvContent = ExportService.exportAdminDataToCSV(detailedData || [])
        ExportService.downloadCSV(csvContent, `detailed-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`)
      }
    } catch (err: any) {
      setError(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const formatPercentage = (value: number) => `${Math.round(value)}%`

  if (!user) return null

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Reports & Analytics</h1>
            <p className="text-gray-600">Comprehensive performance analytics and reporting</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex space-x-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="px-3 py-2 border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="quarter">Last Quarter</option>
                <option value="year">Last Year</option>
              </select>
              <button
                onClick={() => exportReport('summary')}
                disabled={exporting || !analytics}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Export Summary
              </button>
              <button
                onClick={() => exportReport('detailed')}
                disabled={exporting || !analytics}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Export Detailed
              </button>
              <Link
                href="/admin/dashboard"
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                ← Dashboard
              </Link>
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user.profile?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Separator line */}
        <div className="border-b border-gray-200"></div>
      </div>

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error loading analytics: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        ) : analytics && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <div className="flex items-center">
                  <div className="text-3xl font-bold text-emerald-500">{analytics.totalStudents}</div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-purple-900">Total Students</div>
                    <div className="text-xs text-purple-600/70">Registered users</div>
                  </div>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <div className="flex items-center">
                  <div className="text-3xl font-bold text-violet-500">{analytics.completedAttempts}</div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-purple-900">Completed Tests</div>
                    <div className="text-xs text-purple-600/70">of {analytics.totalAttempts} attempts</div>
                  </div>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <div className="flex items-center">
                  <div className="text-3xl font-bold text-blue-500">{analytics.averageScore}</div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-purple-900">Average Score</div>
                    <div className="text-xs text-purple-600/70">Out of 1600</div>
                  </div>
                </div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                <div className="flex items-center">
                  <div className="text-3xl font-bold text-amber-500">
                    {analytics.timeAnalysis.averageTestDuration}min
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-purple-900">Avg Duration</div>
                    <div className="text-xs text-purple-600/70">Test completion time</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6 mb-6">
              <div className="border-b border-purple-200 pb-4">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'performance', label: 'Performance Analysis' },
                    { id: 'trends', label: 'Trends' },
                    { id: 'topics', label: 'Topic Analysis' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveReport(tab.id as any)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeReport === tab.id
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-purple-400 hover:text-purple-700 hover:border-purple-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            {activeReport === 'overview' && (
              <div className="space-y-6">
                {/* Score Distribution */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                  <h3 className="text-lg font-semibold text-purple-900 mb-4">Score Distribution</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-emerald-50 rounded-lg">
                      <div className="text-2xl font-bold text-emerald-500">{analytics.scoreDistribution.excellent}</div>
                      <div className="text-sm text-purple-600/70">Excellent (1200+)</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-500">{analytics.scoreDistribution.good}</div>
                      <div className="text-sm text-purple-600/70">Good (1000-1199)</div>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-500">{analytics.scoreDistribution.fair}</div>
                      <div className="text-sm text-purple-600/70">Fair (800-999)</div>
                    </div>
                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                      <div className="text-2xl font-bold text-slate-500">{analytics.scoreDistribution.poor}</div>
                      <div className="text-sm text-purple-600/70">Needs Improvement (&lt;800)</div>
                    </div>
                  </div>
                </div>

                {/* Module Performance */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                  <h3 className="text-lg font-semibold text-purple-900 mb-4">Module Performance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(analytics.modulePerformance).map(([module, data]) => (
                      <div key={module} className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-lg font-bold text-purple-900">
                          {data.avg}
                        </div>
                        <div className="text-sm text-purple-600 capitalize mb-1">
                          {module.replace(/(\d)/g, ' $1')}
                        </div>
                        <div className="text-xs text-purple-600/70">
                          {data.attempts} attempts
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'performance' && (
              <div className="space-y-6">
                {/* Difficulty Analysis */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                  <h3 className="text-lg font-semibold text-purple-900 mb-4">Performance by Difficulty</h3>
                  <div className="space-y-4">
                    {Object.entries(analytics.difficultyAnalysis).map(([difficulty, stats]) => (
                      <div key={difficulty} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium text-purple-900 capitalize">{difficulty}</div>
                          <div className="text-sm text-purple-600/70">
                            {stats.correct} / {stats.attempted} correct
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-purple-900">
                            {formatPercentage(stats.percentage)}
                          </div>
                          <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className={`h-2 rounded-full ${
                                stats.percentage >= 80 ? 'bg-emerald-500' :
                                stats.percentage >= 60 ? 'bg-amber-500' : 'bg-slate-400'
                              }`}
                              style={{ width: `${stats.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Time Analysis */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                  <h3 className="text-lg font-semibold text-purple-900 mb-4">Time Analysis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-500">
                        {analytics.timeAnalysis.averageTestDuration}min
                      </div>
                      <div className="text-sm text-purple-600/70">Average Duration</div>
                    </div>
                    <div className="text-center p-4 bg-emerald-50 rounded-lg">
                      <div className="text-2xl font-bold text-emerald-500">
                        {analytics.timeAnalysis.fastestCompletion}min
                      </div>
                      <div className="text-sm text-purple-600/70">Fastest Completion</div>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-500">
                        {analytics.timeAnalysis.slowestCompletion}min
                      </div>
                      <div className="text-sm text-purple-600/70">Slowest Completion</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'trends' && (
              <div className="space-y-6">
                {/* Daily Trends */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                  <h3 className="text-lg font-semibold text-purple-900 mb-4">Daily Activity (Last 7 Days)</h3>
                  <div className="space-y-3">
                    {analytics.trends.daily.map((day, index) => (
                      <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <div className="font-medium text-purple-900">
                            {new Date(day.date).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-sm font-medium text-purple-900">
                              {day.completions} tests
                            </div>
                            <div className="text-xs text-purple-600/70">
                              Avg: {day.avgScore || 'N/A'}
                            </div>
                          </div>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ 
                                width: `${(day.completions / Math.max(...analytics.trends.daily.map(d => d.completions), 1)) * 100}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'topics' && (
              <div className="space-y-6">
                {/* Topic Performance */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6">
                  <h3 className="text-lg font-semibold text-purple-900 mb-4">Top 10 Topic Performance</h3>
                  <div className="space-y-3">
                    {analytics.topicPerformance.map((topic, index) => (
                      <div key={topic.topic} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="font-medium text-purple-900">{topic.topic}</div>
                          <div className="text-sm text-purple-600/70">
                            {topic.correct} / {topic.attempted} correct
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-lg font-bold text-purple-900">
                              {formatPercentage(topic.percentage)}
                            </div>
                          </div>
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                topic.percentage >= 80 ? 'bg-emerald-500' :
                                topic.percentage >= 60 ? 'bg-amber-500' : 'bg-slate-400'
                              }`}
                              style={{ width: `${topic.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}