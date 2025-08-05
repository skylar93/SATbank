'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { type TestAttempt, ExamService } from '../../../lib/exam-service'
import { AnalyticsService } from '../../../lib/analytics-service'
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
  averageScore: number | null
  recentAttempts: TestAttempt[]
  canShowResults: boolean
}

interface ScoreHistory {
  date: string
  score: number
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    examsTaken: 0,
    bestScore: null,
    averageScore: null,
    recentAttempts: [],
    canShowResults: true
  })
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadDashboardStats()
    }
  }, [user])

  const loadDashboardStats = async () => {
    try {
      if (user) {
        console.log('🔍 Loading dashboard stats for user:', user.id)
        
        // Fetch all data in parallel using new AnalyticsService
        const [overallStats, scoreHistoryData, recentAttempts] = await Promise.all([
          AnalyticsService.getDashboardOverallStats(user.id),
          AnalyticsService.getDashboardScoreHistory(user.id),
          fetchRecentAttempts(user.id)
        ])

        console.log('📊 Overall stats:', overallStats)
        console.log('📈 Score history:', scoreHistoryData)
        console.log('📝 Recent attempts:', recentAttempts)
        
        // Check if user can see results for completed exams
        let canShowResults = true
        if (recentAttempts.length > 0) {
          // Check the most recent exam's result visibility setting
          const mostRecentExam = recentAttempts[0]
          if (mostRecentExam.exam_id) {
            try {
              canShowResults = await ExamService.canShowResults(user.id, mostRecentExam.exam_id)
            } catch (error) {
              console.log('Could not check result visibility, defaulting to true:', error)
              canShowResults = true
            }
          }
        }
        
        // Debug score history data
        scoreHistoryData.forEach((item, index) => {
          console.log(`Score ${index}:`, item.score, typeof item.score)
        })

        setStats({
          examsTaken: overallStats.examsTaken,
          bestScore: canShowResults ? overallStats.bestScore : null,
          averageScore: canShowResults ? overallStats.averageScore : null,
          recentAttempts,
          canShowResults
        })
        setScoreHistory(canShowResults ? scoreHistoryData : [])
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentAttempts = async (userId: string): Promise<TestAttempt[]> => {
    const supabase = createClientComponentClient()
    const { data, error } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5)

    if (error) throw error
    return data || []
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Real data for score progress chart with fallback for empty data
  const hasScoreData = scoreHistory.length > 0
  const progressData = hasScoreData ? {
    labels: scoreHistory.map(item => {
      const date = new Date(item.date)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }),
    datasets: [
      {
        label: 'Overall Score',
        data: scoreHistory.map(item => item.score),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true
      }
    ]
  } : {
    labels: ['Take your first exam'],
    datasets: [
      {
        label: 'Overall Score',
        data: [0],
        borderColor: '#e5e7eb',
        backgroundColor: 'rgba(229, 231, 235, 0.1)',
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
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
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
        
        {/* Separator line */}
        <div className="border-b border-gray-200"></div>
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
                value={loading ? '...' : !stats.canShowResults ? 'Results Hidden' : (stats.bestScore || 'No scores yet')}
                change="+2.5%"
                changeType="positive"
                miniChart={{
                  data: stats.canShowResults && scoreHistory.length > 0 ? scoreHistory.slice(-6).map(item => item.score) : [0, 0, 0, 0, 0, 0],
                  color: '#10b981'
                }}
              />
              
              <StatsCard
                title="Total Exams"
                value={stats.examsTaken}
                change="+0.8%"
                changeType="positive"
                miniChart={{
                  data: Array.from({length: 6}, (_, i) => Math.max(0, stats.examsTaken - 5 + i)),
                  color: '#8b5cf6'
                }}
              />
              
              <StatsCard
                title="Average Score"
                value={loading ? '...' : !stats.canShowResults ? 'Results Hidden' : (stats.averageScore || 'No scores yet')}
                change="+12%"
                changeType="positive"
                miniChart={{
                  data: stats.canShowResults && scoreHistory.length > 0 ? scoreHistory.slice(-6).map(item => item.score) : [0, 0, 0, 0, 0, 0],
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
              {!stats.canShowResults ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                    <ChartBarIcon className="w-8 h-8 text-orange-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Results Currently Hidden</h4>
                  <p className="text-gray-500 text-sm mb-4">Your instructor has chosen to hide exam results for now.</p>
                </div>
              ) : hasScoreData ? (
                <ModernScoreProgress data={progressData} />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <ChartBarIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No Score History Yet</h4>
                  <p className="text-gray-500 text-sm mb-4">Take your first practice exam to see your progress over time.</p>
                  <Link 
                    href="/student/exams" 
                    className="bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors"
                  >
                    Take Practice Exam
                  </Link>
                </div>
              )}
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
                  percentage={stats.canShowResults && stats.bestScore ? Math.round((stats.bestScore / 1600) * 100) : 0} 
                  size={140} 
                />
              </div>

              <div className="space-y-3">
                {!stats.canShowResults ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">Results Hidden</p>
                    <p className="text-xs text-gray-400 mt-1">Your instructor will release results when ready</p>
                  </div>
                ) : stats.bestScore ? (
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
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-gray-700">Average Score</span>
                      <span className="ml-auto text-sm font-semibold">{stats.averageScore || 'N/A'}</span>
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
                        {stats.canShowResults 
                          ? ((attempt as any).final_scores?.overall || attempt.total_score || 'N/A')
                          : '***'
                        }
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