'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { AnalyticsService } from '../../../lib/analytics-service'
import { ProgressChart } from '../../../components/charts/progress-chart'
import { StatsCard } from '../../../components/modern-charts'
import { supabase } from '../../../lib/supabase'
import { 
  ChartBarIcon, 
  TrophyIcon, 
  FireIcon,
  BookOpenIcon,
  ClockIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline'

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
    <div className="h-full bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm md:text-base text-gray-600 hidden sm:block">Monitor student performance and system analytics</p>
          </div>
          <div className="flex items-center space-x-4 flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user.profile?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
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
            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-6">
              {/* Left Column - 9 cols */}
              <div className="col-span-1 xl:col-span-9 space-y-4 md:space-y-6">
                {/* Top Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  <StatsCard
                    title="Total Students"
                    value={stats.totalStudents}
                    change="+12%"
                    changeType="positive"
                    miniChart={{
                      data: [15, 18, 22, 19, 25, stats.totalStudents],
                      color: '#10b981'
                    }}
                  />
                  
                  <StatsCard
                    title="Completed Tests"
                    value={stats.totalAttempts}
                    change="+8.5%"
                    changeType="positive"
                    miniChart={{
                      data: [45, 52, 48, 63, 71, stats.totalAttempts],
                      color: '#8b5cf6'
                    }}
                  />
                  
                  <StatsCard
                    title="Average Score"
                    value={stats.averageScore}
                    change="+2.1%"
                    changeType="positive"
                    miniChart={{
                      data: [1050, 1120, 1080, 1150, 1180, stats.averageScore],
                      color: '#f59e0b'
                    }}
                  />
                </div>

                {/* Analytics Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4 md:mb-6">Test Completions (Last 7 Days)</h3>
                    <ProgressChart
                      data={stats.weeklyTrend}
                      title=""
                      type="line"
                      color="#10B981"
                      height={250}
                    />
                  </div>
                  
                  <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4 md:mb-6">Score Distribution</h3>
                    <ProgressChart
                      data={stats.scoreDistribution}
                      title=""
                      type="bar"
                      color="#3B82F6"
                      height={250}
                    />
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4 md:mb-6">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link
                      href="/admin/students"
                      className="flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                    >
                      <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mr-4">
                        <AcademicCapIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">View Students</h4>
                        <p className="text-sm text-gray-600">Manage all students</p>
                      </div>
                    </Link>

                    <Link
                      href="/admin/exams"
                      className="flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors"
                    >
                      <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center mr-4">
                        <BookOpenIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Exams</h4>
                        <p className="text-sm text-gray-600">Manage exams</p>
                      </div>
                    </Link>

                    <Link
                      href="/admin/reports"
                      className="flex items-center p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors"
                    >
                      <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center mr-4">
                        <ChartBarIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Reports</h4>
                        <p className="text-sm text-gray-600">View analytics</p>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Right Column - 3 cols */}
              <div className="col-span-1 xl:col-span-3 space-y-4 md:space-y-6">
                {/* System Overview */}
                <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">System Overview</h3>
                    <button className="text-sm text-gray-500 hover:text-gray-700">Refresh</button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Today's Tests</span>
                      <span className="font-semibold text-gray-900">{stats.completedToday}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Active Students</span>
                      <span className="font-semibold text-gray-900">{stats.totalStudents}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Avg Score</span>
                      <span className="font-semibold text-gray-900">{stats.averageScore}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Test Attempts */}
                <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">Recent Completions</h3>
                    <Link
                      href="/admin/students"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View all
                    </Link>
                  </div>
                  
                  <div className="space-y-4">
                    {recentAttempts.slice(0, 5).map((attempt) => (
                      <div key={attempt.id} className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">
                            {attempt.user_profiles?.full_name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {attempt.user_profiles?.full_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Score: {attempt.total_score}/1600
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatDate(attempt.completed_at)}
                        </span>
                      </div>
                    ))}
                    
                    {recentAttempts.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-gray-500 text-sm">No recent completions</p>
                        <p className="text-xs text-gray-400 mt-1">Test results will appear here</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin Actions CTA */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-sm p-4 md:p-6 text-white">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <TrophyIcon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">System Running</h3>
                    <p className="text-indigo-100 text-sm mb-4">Monitor student progress and manage the platform efficiently.</p>
                    <Link
                      href="/admin/reports"
                      className="bg-white text-indigo-600 font-semibold py-2 px-6 rounded-lg hover:bg-indigo-50 transition-colors inline-block"
                    >
                      View Reports
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}