'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { type TestAttempt } from '../../../lib/exam-service'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { ProgressChart, SubjectPerformanceChart, WeeklyActivityChart, CircularProgress } from '../../../components/charts'
import { ModernScoreProgress, StatsCard } from '../../../components/modern-charts'
import { Calendar } from '../../../components/calendar'
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

interface DashboardStats {
  examsTaken: number
  bestScore: number | null
  recentAttempts: TestAttempt[]
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    examsTaken: 0,
    bestScore: null,
    recentAttempts: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadDashboardStats()
    }
  }, [user])

  const loadDashboardStats = async () => {
    try {
      if (user) {
        const supabase = createClientComponentClient()
        
        // Get all completed attempts for user
        const { data: completedAttempts, error } = await supabase
          .from('test_attempts')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })

        if (error) {
          console.error('Error fetching test attempts:', error)
          throw error
        }

        const attempts = completedAttempts || []
        const examsTaken = attempts.length
        const bestScore = attempts.length > 0 
          ? Math.max(...attempts.map(attempt => attempt.total_score || 0))
          : null
        const recentAttempts = attempts.slice(0, 5) // Last 5 attempts

        setStats({
          examsTaken,
          bestScore,
          recentAttempts
        })
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
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

  // Mock data for charts - replace with real data
  const progressData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Math Score',
        data: [720, 740, 760, 730, 780, 790],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true
      },
      {
        label: 'Reading & Writing',
        data: [650, 670, 690, 680, 720, 710],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true
      }
    ]
  }

  const subjectData = {
    reading: 650,
    writing: 670,
    math: 720
  }

  const weeklyData = {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    studyTime: [2, 3, 1, 4, 2, 0, 1],
    practiceTests: [1, 0, 0, 1, 1, 0, 0]
  }

  const studyStreakDays = [
    '2024-03-15', '2024-03-16', '2024-03-17', '2024-03-19', '2024-03-20'
  ]

  if (!user) return null

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Hello {user.profile?.full_name?.split(' ')[0]}, welcome back</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user.profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Main Grid Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - 9 cols */}
          <div className="col-span-12 lg:col-span-9 space-y-6">
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatsCard
                title="Your Score This Month"
                value={loading ? '...' : stats.bestScore || 'No scores yet'}
                change="+2.5%"
                changeType="positive"
                miniChart={{
                  data: [1200, 1250, 1300, 1280, 1350, 1400],
                  color: '#10b981'
                }}
              />
              
              <StatsCard
                title="Total Exams"
                value={stats.examsTaken}
                change="+0.8%"
                changeType="positive"
                miniChart={{
                  data: [8, 12, 15, 18, 22, 25],
                  color: '#8b5cf6'
                }}
              />
              
              <StatsCard
                title="Study Streak"
                value="7 days"
                change="+12%"
                changeType="positive"
                miniChart={{
                  data: [3, 5, 4, 6, 7, 7],
                  color: '#f59e0b'
                }}
              />
            </div>

            {/* Score Progress Chart - Full Width */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Score Progress</h3>
                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 text-sm bg-violet-100 text-violet-600 rounded-lg">This Week</button>
                  <button className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">Last Week</button>
                </div>
              </div>
              <ModernScoreProgress data={progressData} />
            </div>

            {/* Subject Performance */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Subject Performance</h3>
              <SubjectPerformanceChart data={subjectData} />
            </div>

            {/* Weekly Activity */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Weekly Activity</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">This Week</span>
                  <select className="text-sm border border-gray-300 rounded-lg px-2 py-1">
                    <option>This Week</option>
                    <option>Last Week</option>
                    <option>This Month</option>
                  </select>
                </div>
              </div>
              <WeeklyActivityChart data={weeklyData} />
            </div>

          </div>

          {/* Right Column - 3 cols */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            {/* Calendar */}
            <Calendar events={studyStreakDays.map(date => ({ date: new Date(date), type: 'visit' as const }))} />

            {/* Affiliate impressions equivalent - Performance Summary */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Performance Summary</h3>
                <button className="text-sm text-gray-500 hover:text-gray-700">Update</button>
              </div>
              
              <div className="flex justify-center mb-6">
                <CircularProgress 
                  percentage={stats.bestScore ? Math.round((stats.bestScore / 1600) * 100) : 0} 
                  size={140} 
                />
              </div>

              <div className="space-y-3">
                {stats.bestScore ? (
                  <>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-violet-500"></div>
                      <span className="text-sm text-gray-700">Best Score</span>
                      <span className="ml-auto text-sm font-semibold">{stats.bestScore}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <span className="text-sm text-gray-700">Exams Taken</span>
                      <span className="ml-auto text-sm font-semibold">{stats.examsTaken}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">No exam data yet</p>
                    <p className="text-xs text-gray-400 mt-1">Take your first exam to see performance here</p>
                  </div>
                )}
              </div>
            </div>

            {/* Latest Activities */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Latest Activities</h3>
                <button className="text-sm text-violet-600 hover:text-violet-700 font-medium">View all</button>
              </div>
              
              <div className="space-y-4">
                {stats.recentAttempts.slice(0, 3).map((attempt, index) => (
                  <div key={attempt.id} className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                      <span className="text-violet-600 font-semibold text-sm">
                        {attempt.total_score}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">SAT Practice Test</p>
                      <p className="text-xs text-gray-500">
                        {attempt.completed_at ? formatDate(attempt.completed_at) : 'In Progress'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {index === 0 ? '1h30m' : index === 1 ? '2 days' : '1 week'}
                    </span>
                  </div>
                ))}
                
                {stats.recentAttempts.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">No recent activity</p>
                    <p className="text-xs text-gray-400 mt-1">Take your first exam to see progress here</p>
                  </div>
                )}
              </div>
            </div>

            {/* Call to Action - Invite User equivalent */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-sm p-6 text-white">
              <div className="text-center">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FireIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Keep Your Streak!</h3>
                <p className="text-blue-100 text-sm mb-4">You're doing great! Continue your daily practice to reach your target score.</p>
                <button className="bg-white text-blue-600 font-semibold py-2 px-6 rounded-lg hover:bg-blue-50 transition-colors">
                  Continue Practice
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}