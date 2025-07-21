'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { Navigation } from '../../../components/navigation'
import { AnalyticsService } from '../../../lib/analytics-service'
import { ProgressChart } from '../../../components/charts/progress-chart'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface AdminStats {
  totalStudents: number
  totalAttempts: number
  averageScore: number
  completedToday: number
  weeklyTrend: Array<{ label: string; value: number; date: string }>
  scoreDistribution: Array<{ label: string; value: number }>
}

interface RecentAttempt {
  id: string
  user_id: string
  total_score: number
  completed_at: string
  user_profiles: {
    full_name: string
    email: string
  }
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AdminStats>({
    totalStudents: 0,
    totalAttempts: 0,
    averageScore: 0,
    completedToday: 0,
    weeklyTrend: [],
    scoreDistribution: []
  })
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    try {
      // Load basic stats
      const [studentsData, attemptsData, todayAttemptsData] = await Promise.all([
        supabase.from('user_profiles').select('id').eq('role', 'student'),
        supabase.from('test_attempts').select('*').eq('status', 'completed'),
        supabase.from('test_attempts').select('*').eq('status', 'completed').gte('completed_at', new Date().toISOString().split('T')[0])
      ])

      if (studentsData.error) throw studentsData.error
      if (attemptsData.error) throw attemptsData.error
      if (todayAttemptsData.error) throw todayAttemptsData.error

      const totalStudents = studentsData.data?.length || 0
      const totalAttempts = attemptsData.data?.length || 0
      const averageScore = totalAttempts > 0 
        ? Math.round(attemptsData.data.reduce((sum, attempt) => sum + (attempt.total_score || 0), 0) / totalAttempts)
        : 0
      const completedToday = todayAttemptsData.data?.length || 0

      // Generate weekly trend data
      const weeklyTrend = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        const dayAttempts = attemptsData.data?.filter(a => 
          a.completed_at && a.completed_at.startsWith(dateStr)
        ) || []
        
        weeklyTrend.push({
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
          value: dayAttempts.length,
          date: dateStr
        })
      }

      // Generate score distribution
      const scores = attemptsData.data?.map(a => a.total_score).filter(Boolean) || []
      const scoreDistribution = [
        { label: 'Excellent (1200+)', value: scores.filter(s => s >= 1200).length },
        { label: 'Good (1000-1199)', value: scores.filter(s => s >= 1000 && s < 1200).length },
        { label: 'Fair (800-999)', value: scores.filter(s => s >= 800 && s < 1000).length },
        { label: 'Needs Work (<800)', value: scores.filter(s => s < 800).length }
      ]

      setStats({
        totalStudents,
        totalAttempts,
        averageScore,
        completedToday,
        weeklyTrend,
        scoreDistribution
      })

      // Load recent attempts with user details - join manually since no direct FK
      const { data: recentAttemptsData, error: recentAttemptsError } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10)

      if (recentAttemptsError) throw recentAttemptsError

      // Get user profiles for the attempts
      const userIds = recentAttemptsData?.map(attempt => attempt.user_id).filter(Boolean) || []
      let recentData = recentAttemptsData || []

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', userIds)

        if (profilesError) throw profilesError

        // Manually join the data
        recentData = recentAttemptsData?.map(attempt => ({
          ...attempt,
          user_profiles: profilesData?.find(profile => profile.id === attempt.user_id) || null
        })) || []
      }

      setRecentAttempts(recentData)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 1200) return 'text-green-600'
    if (score >= 1000) return 'text-blue-600'
    if (score >= 800) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Monitor student performance and system analytics
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">Error loading dashboard: {error}</p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading dashboard...</p>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">👥</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Total Students
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">{stats.totalStudents}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">📝</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Completed Tests
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">{stats.totalAttempts}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">📊</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Average Score
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">{stats.averageScore}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">🎯</span>
                        </div>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Completed Today
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">{stats.completedToday}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Student Analytics
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      View comprehensive student performance data and progress tracking.
                    </p>
                    <Link
                      href="/admin/students"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors inline-block text-center"
                    >
                      View All Students
                    </Link>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Exam Management
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Create new exams, manage questions, and configure test settings.
                    </p>
                    <Link
                      href="/admin/exams"
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium transition-colors inline-block text-center"
                    >
                      Manage Exams
                    </Link>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Exam Assignments
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Assign specific exams to students and manage access permissions.
                    </p>
                    <Link
                      href="/admin/assignments"
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-medium transition-colors inline-block text-center"
                    >
                      Manage Assignments
                    </Link>
                  </div>
                </div>
              </div>

              {/* Analytics Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <ProgressChart
                  data={stats.weeklyTrend}
                  title="Test Completions (Last 7 Days)"
                  type="line"
                  color="#10B981"
                  height={250}
                />
                <ProgressChart
                  data={stats.scoreDistribution}
                  title="Score Distribution"
                  type="bar"
                  color="#3B82F6"
                  height={250}
                />
              </div>

              {/* Recent Test Attempts */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Recent Test Completions
                    </h3>
                    <Link
                      href="/admin/students"
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View All →
                    </Link>
                  </div>
                  
                  {recentAttempts.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No completed tests yet</p>
                  ) : (
                    <div className="overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Student
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Score
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Completed
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {recentAttempts.map((attempt) => (
                            <tr key={attempt.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {attempt.user_profiles?.full_name || 'Unknown'}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {attempt.user_profiles?.email || ''}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className={`text-sm font-medium ${getScoreColor(attempt.total_score)}`}>
                                  {attempt.total_score}
                                </div>
                                <div className="text-xs text-gray-500">/ 1600</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatDate(attempt.completed_at)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <Link
                                  href={`/student/results/${attempt.id}`}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  View Details
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}