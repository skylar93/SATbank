'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { ExportService } from '../../../lib/export-service'
import { supabase } from '../../../lib/supabase'
import {
  MagnifyingGlassIcon,
  ChartBarIcon,
  DocumentArrowDownIcon,
  EyeIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'

interface SystemAnalytics {
  totalStudents: number
  totalAttempts: number
  completedAttempts: number
  averageScore: number
  scoreDistribution: {
    excellent: number // 1200+
    good: number // 1000-1199
    fair: number // 800-999
    poor: number // <800
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

interface StudentAttempt {
  id: string
  user_id: string
  student_name: string
  student_email: string
  total_score: number
  completed_at: string
  english_score: number
  math_score: number
  duration_minutes: number
}

export default function AdminReportsPage() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null)
  const [studentAttempts, setStudentAttempts] = useState<StudentAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<
    'week' | 'month' | 'quarter' | 'year'
  >('month')
  const [exporting, setExporting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (user) {
      loadAnalytics()
      loadStudentAttempts()
    }
  }, [user, dateRange])

  const getDateFilter = () => {
    const now = new Date()
    const ranges = {
      week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      quarter: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      year: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
    }
    return ranges[dateRange].toISOString()
  }

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const dateFilter = getDateFilter()

      // Load basic metrics
      const [studentsResult, attemptsResult, completedResult] =
        await Promise.all([
          supabase.from('user_profiles').select('id').eq('role', 'student'),
          supabase
            .from('test_attempts')
            .select('*')
            .gte('created_at', dateFilter),
          supabase
            .from('test_attempts')
            .select('*')
            .eq('status', 'completed')
            .gte('completed_at', dateFilter),
        ])

      if (studentsResult.error) throw studentsResult.error
      if (attemptsResult.error) throw attemptsResult.error
      if (completedResult.error) throw completedResult.error

      const students = studentsResult.data || []
      const attempts = attemptsResult.data || []
      const completedAttempts = completedResult.data || []

      // Calculate score distribution
      const scores = completedAttempts.map((a) => a.total_score).filter(Boolean)
      const scoreDistribution = {
        excellent: scores.filter((s) => s >= 1200).length,
        good: scores.filter((s) => s >= 1000 && s < 1200).length,
        fair: scores.filter((s) => s >= 800 && s < 1000).length,
        poor: scores.filter((s) => s < 800).length,
      }

      // Calculate module performance
      const moduleScores = completedAttempts.reduce(
        (acc, attempt) => {
          if (attempt.module_scores) {
            Object.entries(attempt.module_scores).forEach(([module, score]) => {
              if (!acc[module]) acc[module] = { total: 0, count: 0 }
              acc[module].total += score as number
              acc[module].count += 1
            })
          }
          return acc
        },
        {} as Record<string, { total: number; count: number }>
      )

      const modulePerformance = {
        english1: {
          avg: moduleScores.english1
            ? Math.round(
                moduleScores.english1.total / moduleScores.english1.count
              )
            : 0,
          attempts: moduleScores.english1?.count || 0,
        },
        english2: {
          avg: moduleScores.english2
            ? Math.round(
                moduleScores.english2.total / moduleScores.english2.count
              )
            : 0,
          attempts: moduleScores.english2?.count || 0,
        },
        math1: {
          avg: moduleScores.math1
            ? Math.round(moduleScores.math1.total / moduleScores.math1.count)
            : 0,
          attempts: moduleScores.math1?.count || 0,
        },
        math2: {
          avg: moduleScores.math2
            ? Math.round(moduleScores.math2.total / moduleScores.math2.count)
            : 0,
          attempts: moduleScores.math2?.count || 0,
        },
      }

      // Load difficulty and topic analysis from user answers - simplified to avoid relationship issues
      const { data: answersData } = await supabase
        .from('user_answers')
        .select('*')
        .in('attempt_id', completedAttempts.map(a => a.id))

      const difficultyStats = {
        easy: { attempted: 0, correct: 0, percentage: 0 },
        medium: { attempted: 0, correct: 0, percentage: 0 },
        hard: { attempted: 0, correct: 0, percentage: 0 },
      }

      const topicStats: Record<string, { attempted: number; correct: number }> =
        {}

      answersData?.forEach((answer) => {
        const question = answer.questions
        if (question) {
          // Difficulty analysis
          const difficulty = question.difficulty_level
          if (difficultyStats[difficulty as keyof typeof difficultyStats]) {
            difficultyStats[difficulty as keyof typeof difficultyStats]
              .attempted++
            if (answer.is_correct) {
              difficultyStats[difficulty as keyof typeof difficultyStats]
                .correct++
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
      Object.keys(difficultyStats).forEach((key) => {
        const diff = difficultyStats[key as keyof typeof difficultyStats]
        diff.percentage =
          diff.attempted > 0 ? (diff.correct / diff.attempted) * 100 : 0
      })

      const topicPerformance = Object.entries(topicStats)
        .map(([topic, stats]) => ({
          topic,
          attempted: stats.attempted,
          correct: stats.correct,
          percentage:
            stats.attempted > 0 ? (stats.correct / stats.attempted) * 100 : 0,
        }))
        .sort((a, b) => b.attempted - a.attempted)
        .slice(0, 10)

      // Time analysis
      const durations = completedAttempts
        .filter((a) => a.started_at && a.completed_at)
        .map((a) => {
          const start = new Date(a.started_at).getTime()
          const end = new Date(a.completed_at).getTime()
          return (end - start) / (1000 * 60) // minutes
        })

      const timeAnalysis = {
        averageTestDuration:
          durations.length > 0
            ? Math.round(
                durations.reduce((sum, d) => sum + d, 0) / durations.length
              )
            : 0,
        fastestCompletion:
          durations.length > 0 ? Math.round(Math.min(...durations)) : 0,
        slowestCompletion:
          durations.length > 0 ? Math.round(Math.max(...durations)) : 0,
        timeByModule: {
          english1: 32, // Default expected times
          english2: 32,
          math1: 35,
          math2: 35,
        },
      }

      // Trends analysis (simplified - daily for last 7 days)
      const dailyTrends = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]

        const dayAttempts = completedAttempts.filter((a) =>
          a.completed_at.startsWith(dateStr)
        )

        dailyTrends.push({
          date: dateStr,
          completions: dayAttempts.length,
          avgScore:
            dayAttempts.length > 0
              ? Math.round(
                  dayAttempts.reduce(
                    (sum, a) => sum + (a.total_score || 0),
                    0
                  ) / dayAttempts.length
                )
              : 0,
        })
      }

      const analyticsData: SystemAnalytics = {
        totalStudents: students.length,
        totalAttempts: attempts.length,
        completedAttempts: completedAttempts.length,
        averageScore:
          scores.length > 0
            ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
            : 0,
        scoreDistribution,
        modulePerformance,
        difficultyAnalysis: difficultyStats,
        topicPerformance,
        timeAnalysis,
        trends: {
          daily: dailyTrends,
          weekly: [], // Could be implemented
          monthly: [], // Could be implemented
        },
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
          ...analytics,
        }

        const blob = new Blob([JSON.stringify(reportData, null, 2)], {
          type: 'application/json',
        })
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
          .select(
            `
            *,
            user_profiles:user_id (full_name, email, grade_level, target_score)
          `
          )
          .eq('status', 'completed')
          .gte('completed_at', getDateFilter())

        const csvContent = ExportService.exportAdminDataToCSV(
          detailedData || []
        )
        ExportService.downloadCSV(
          csvContent,
          `detailed-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`
        )
      }
    } catch (err: any) {
      setError(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const loadStudentAttempts = async () => {
    try {
      const dateFilter = getDateFilter()
      
      const { data: attemptsData, error } = await supabase
        .from('test_attempts')
        .select(`
          id,
          user_id,
          total_score,
          completed_at,
          started_at,
          final_scores
        `)
        .eq('status', 'completed')
        .gte('completed_at', dateFilter)
        .order('completed_at', { ascending: false })

      if (error) throw error

      // Get user profiles separately
      const userIds = attemptsData?.map(attempt => attempt.user_id) || []
      const { data: profilesData } = await supabase
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      // Create a map for quick profile lookup
      const profileMap = new Map(profilesData?.map(profile => [profile.id, profile]) || [])

      const formattedAttempts: StudentAttempt[] = attemptsData?.map(attempt => {
        const startTime = new Date(attempt.started_at).getTime()
        const endTime = new Date(attempt.completed_at).getTime()
        const durationMinutes = Math.round((endTime - startTime) / (1000 * 60))
        
        const profile = profileMap.get(attempt.user_id)

        // Calculate total score from final_scores if total_score is missing or 0
        const englishScore = attempt.final_scores?.english || 0
        const mathScore = attempt.final_scores?.math || 0
        const calculatedTotal = englishScore + mathScore
        const totalScore = attempt.total_score && attempt.total_score > 0 
          ? attempt.total_score 
          : calculatedTotal

        return {
          id: attempt.id,
          user_id: attempt.user_id,
          student_name: profile?.full_name || 'Unknown',
          student_email: profile?.email || 'Unknown',
          total_score: totalScore,
          completed_at: attempt.completed_at,
          english_score: englishScore,
          math_score: mathScore,
          duration_minutes: durationMinutes
        }
      }) || []

      setStudentAttempts(formattedAttempts)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const formatPercentage = (value: number) => `${Math.round(value)}%`

  const filteredStudentAttempts = studentAttempts.filter(
    (attempt) =>
      attempt.student_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      attempt.student_email
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase())
  )

  if (!user) return null

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Reports
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex space-x-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="quarter">Last Quarter</option>
                <option value="year">Last Year</option>
              </select>
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
        {/* Search */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 p-6 mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-3 text-purple-400" />
            <input
              type="text"
              placeholder="Search student results..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error loading analytics: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        ) : (
          analytics && (
            <>

              {/* Student Test Results Section */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 overflow-hidden mb-6">
                <div className="p-6 border-b border-purple-100">
                  <div className="flex items-center">
                    <ChartBarIcon className="w-6 h-6 text-purple-500 mr-3" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Student Test Results
                    </h3>
                  </div>
                </div>
                
                {filteredStudentAttempts.length === 0 ? (
                  <div className="text-center py-12">
                    <ChartBarIcon className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                    <p className="text-purple-600/70">No test results found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-purple-200">
                      <thead className="bg-gradient-to-r from-purple-50 to-pink-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Student</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Total Score</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">English</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Math</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Duration</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Completed</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-800 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-purple-100">
                        {filteredStudentAttempts.map((attempt) => (
                          <tr 
                            key={attempt.id} 
                            className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200 cursor-pointer"
                            onClick={() => window.open(`/admin/results/${attempt.id}`, '_blank')}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{attempt.student_name}</div>
                                <div className="text-sm text-gray-600">{attempt.student_email}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {attempt.total_score}/1600
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {attempt.english_score}/800
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {attempt.math_score}/800
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{attempt.duration_minutes} min</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {new Date(attempt.completed_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-3">
                                <Link
                                  href={`/admin/results/${attempt.id}`}
                                  className="text-gray-600 hover:text-gray-800"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <EyeIcon className="w-5 h-5" />
                                </Link>
                                <Link
                                  href={`/admin/results/${attempt.id}/review`}
                                  className="text-gray-600 hover:text-gray-800"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <PencilSquareIcon className="w-5 h-5" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </>
          )
        )}
      </div>
    </div>
  )
}
