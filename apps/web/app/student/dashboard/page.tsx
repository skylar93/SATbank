'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { type TestAttempt, ExamService } from '../../../lib/exam-service'
import { AnalyticsService } from '../../../lib/analytics-service'
import { WeeklyActivityService, type WeeklyActivityData } from '../../../lib/weekly-activity-service'
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
import { formatTimeAgo } from '../../../lib/utils'

interface DashboardStats {
  examsTaken: number
  bestScore: number | null
  averageScore: number | null
  recentAttempts: TestAttempt[]
  canShowResults: boolean
  previousMonthBestScore: number | null
  previousMonthExamsTaken: number
  previousMonthAverageScore: number | null
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
    canShowResults: true,
    previousMonthBestScore: null,
    previousMonthExamsTaken: 0,
    previousMonthAverageScore: null
  })
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([])
  const [studyStreakDays, setStudyStreakDays] = useState<string[]>([])
  const [subjectData, setSubjectData] = useState<{reading: number, writing: number, math: number}>({
    reading: 0,
    writing: 0,
    math: 0
  })
  const [weeklyActivityData, setWeeklyActivityData] = useState<WeeklyActivityData>({
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    studyTime: [0, 0, 0, 0, 0, 0, 0],
    practiceTests: [0, 0, 0, 0, 0, 0, 0]
  })
  const [loading, setLoading] = useState(true)
  const [weeklyActivityLoading, setWeeklyActivityLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadDashboardStats()
    }
  }, [user])

  const loadDashboardStats = async () => {
    try {
      if (user) {
        
        // Fetch all data in parallel using new AnalyticsService
        const [overallStats, scoreHistoryData, recentAttempts, previousMonthStats, activityDays, weeklyActivity, subjectScores] = await Promise.all([
          AnalyticsService.getDashboardOverallStats(user.id),
          AnalyticsService.getDashboardScoreHistory(user.id),
          fetchRecentAttempts(user.id),
          fetchPreviousMonthStats(user.id),
          fetchUserActivityDays(user.id),
          WeeklyActivityService.fetchWeeklyActivityData(user.id),
          fetchUserSubjectScores(user.id)
        ])

        
        // Check if user can see results for completed exams
        let canShowResults = true
        if (recentAttempts.length > 0) {
          // Check the most recent exam's result visibility setting
          const mostRecentExam = recentAttempts[0]
          if (mostRecentExam.exam_id) {
            try {
              canShowResults = await ExamService.canShowResults(user.id, mostRecentExam.exam_id)
            } catch (error) {
              canShowResults = true
            }
          }
        }
        

        setStats({
          examsTaken: overallStats.examsTaken,
          bestScore: canShowResults ? overallStats.bestScore : null,
          averageScore: canShowResults ? overallStats.averageScore : null,
          recentAttempts,
          canShowResults,
          previousMonthBestScore: canShowResults ? previousMonthStats.bestScore : null,
          previousMonthExamsTaken: previousMonthStats.examsTaken,
          previousMonthAverageScore: canShowResults ? previousMonthStats.averageScore : null
        })
        setScoreHistory(canShowResults ? scoreHistoryData : [])
        setStudyStreakDays(activityDays)
        setWeeklyActivityData(weeklyActivity)
        setSubjectData(canShowResults ? subjectScores : { reading: 0, writing: 0, math: 0 })
      }
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentAttempts = async (userId: string): Promise<TestAttempt[]> => {
    // Use the same method as AnalyticsService for consistency
    const userAttempts = await ExamService.getUserAttempts(userId)
    
    // Filter valid attempts (same logic as results page)
    const validAttempts = userAttempts.filter(attempt => 
      attempt.status !== 'not_started' && attempt.status !== 'expired'
    )
    
    // Sort by status (completed first) then by created_at descending
    const sortedAttempts = validAttempts.sort((a, b) => {
      // First priority: completed attempts come before in_progress
      if (a.status === 'completed' && b.status !== 'completed') return -1
      if (a.status !== 'completed' && b.status === 'completed') return 1
      
      // Second priority: sort by creation date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }).slice(0, 5)
    
    return sortedAttempts
  }

  const fetchPreviousMonthStats = async (userId: string) => {
    const supabase = createClientComponentClient()
    const now = new Date()
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

    const { data, error } = await supabase
      .from('test_attempts')
      .select('total_score, final_scores')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('completed_at', startOfPreviousMonth.toISOString())
      .lte('completed_at', endOfPreviousMonth.toISOString())

    if (error) {
      return { examsTaken: 0, bestScore: null, averageScore: null }
    }

    const attempts = data || []
    const examsTaken = attempts.length
    
    if (examsTaken === 0) {
      return { examsTaken: 0, bestScore: null, averageScore: null }
    }

    const scores = attempts.map(attempt => {
      return (attempt as any).final_scores?.overall || attempt.total_score || 0
    }).filter(score => score > 0)

    const bestScore = scores.length > 0 ? Math.max(...scores) : null
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null

    return { examsTaken, bestScore, averageScore }
  }

  const fetchUserActivityDays = async (userId: string): Promise<string[]> => {
    const supabase = createClientComponentClient()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get dates when user completed tests, started tests, or accessed problem bank
    const [completedTests, startedTests] = await Promise.all([
      supabase
        .from('test_attempts')
        .select('completed_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('test_attempts')
        .select('started_at')
        .eq('user_id', userId)
        .gte('started_at', thirtyDaysAgo.toISOString())
    ])

    const activityDates = new Set<string>()

    // Add completed test dates
    completedTests.data?.forEach(attempt => {
      if (attempt.completed_at) {
        activityDates.add(attempt.completed_at.split('T')[0])
      }
    })

    // Add started test dates
    startedTests.data?.forEach(attempt => {
      if (attempt.started_at) {
        activityDates.add(attempt.started_at.split('T')[0])
      }
    })

    return Array.from(activityDates).sort()
  }

  const fetchUserSubjectScores = async (userId: string): Promise<{reading: number, writing: number, math: number}> => {
    const supabase = createClientComponentClient()
    
    // Get the most recent completed test attempt
    const { data: attempts, error } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)

    if (error || !attempts || attempts.length === 0) {
      return { reading: 0, writing: 0, math: 0 }
    }

    const mostRecentAttempt = attempts[0]

    // Check if we have final_scores data
    if (mostRecentAttempt.final_scores && mostRecentAttempt.final_scores.english && mostRecentAttempt.final_scores.math) {
      // Use final_scores data
      const englishScore = mostRecentAttempt.final_scores.english
      const mathScore = mostRecentAttempt.final_scores.math
      
      // For SAT, reading and writing are combined into Evidence-Based Reading and Writing (EBRW)
      // We'll split the english score evenly between reading and writing for display
      return {
        reading: Math.round(englishScore / 2),
        writing: Math.round(englishScore / 2), 
        math: mathScore
      }
    }

    // Fallback: Calculate from user answers if no final_scores available
    const { data: answers, error: answersError } = await supabase
      .from('user_answers')
      .select(`
        *,
        questions:question_id (
          module_type,
          difficulty_level
        )
      `)
      .eq('attempt_id', mostRecentAttempt.id)

    if (answersError || !answers) {
      return { reading: 0, writing: 0, math: 0 }
    }

    // Calculate scores by module
    const moduleStats = {
      english1: { correct: 0, total: 0 },
      english2: { correct: 0, total: 0 },
      math1: { correct: 0, total: 0 },
      math2: { correct: 0, total: 0 }
    }

    answers.forEach((answer: any) => {
      const question = answer.questions
      if (question && question.module_type) {
        moduleStats[question.module_type as keyof typeof moduleStats].total++
        if (answer.is_correct) {
          moduleStats[question.module_type as keyof typeof moduleStats].correct++
        }
      }
    })

    // Convert to approximate SAT scores (simplified conversion)
    const convertToScore = (correct: number, total: number) => {
      if (total === 0) return 0
      const percentage = correct / total
      return Math.round(200 + (percentage * 600)) // Scale to 200-800 range
    }

    const readingScore = convertToScore(moduleStats.english1.correct, moduleStats.english1.total)
    const writingScore = convertToScore(moduleStats.english2.correct, moduleStats.english2.total)
    const mathScore = convertToScore(
      moduleStats.math1.correct + moduleStats.math2.correct, 
      moduleStats.math1.total + moduleStats.math2.total
    )

    return {
      reading: readingScore,
      writing: writingScore,
      math: mathScore
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

  const calculatePercentageChange = (current: number | null, previous: number | null): { change: string, isZero: boolean } => {
    if (!current || !previous || previous === 0) {
      return { change: "0%", isZero: true }
    }
    const change = ((current - previous) / previous) * 100
    const prefix = change >= 0 ? "+" : ""
    return { change: `${prefix}${change.toFixed(1)}%`, isZero: false }
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



  // studyStreakDays is now loaded from real data via useState

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
                change={(() => {
                  const result = calculatePercentageChange(stats.bestScore, stats.previousMonthBestScore)
                  return result.change
                })()}
                changeType={(() => {
                  const result = calculatePercentageChange(stats.bestScore, stats.previousMonthBestScore)
                  if (result.isZero) return "neutral"
                  return stats.bestScore && stats.previousMonthBestScore && stats.bestScore >= stats.previousMonthBestScore ? "positive" : "negative"
                })()}
                miniChart={{
                  data: stats.canShowResults && scoreHistory.length > 0 ? scoreHistory.slice(-6).map(item => item.score) : [0, 0, 0, 0, 0, 0],
                  color: '#10b981'
                }}
              />
              
              <StatsCard
                title="Total Exams"
                value={stats.examsTaken}
                change={(() => {
                  const result = calculatePercentageChange(stats.examsTaken, stats.previousMonthExamsTaken)
                  return result.change
                })()}
                changeType={(() => {
                  const result = calculatePercentageChange(stats.examsTaken, stats.previousMonthExamsTaken)
                  if (result.isZero) return "neutral"
                  return stats.examsTaken >= stats.previousMonthExamsTaken ? "positive" : "negative"
                })()}
                miniChart={{
                  data: Array.from({length: 6}, (_, i) => Math.max(0, stats.examsTaken - 5 + i)),
                  color: '#8b5cf6'
                }}
              />
              
              <StatsCard
                title="Average Score"
                value={loading ? '...' : !stats.canShowResults ? 'Results Hidden' : (stats.averageScore || 'No scores yet')}
                change={(() => {
                  const result = calculatePercentageChange(stats.averageScore, stats.previousMonthAverageScore)
                  return result.change
                })()}
                changeType={(() => {
                  const result = calculatePercentageChange(stats.averageScore, stats.previousMonthAverageScore)
                  if (result.isZero) return "neutral"
                  return stats.averageScore && stats.previousMonthAverageScore && stats.averageScore >= stats.previousMonthAverageScore ? "positive" : "negative"
                })()}
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
              {weeklyActivityLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-violet-600 rounded-full animate-spin"></div>
                </div>
              ) : (
                <WeeklyActivityChart data={weeklyActivityData} />
              )}
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
                {stats.recentAttempts.slice(0, 3).map((attempt, index) => {
                  return (
                  <div key={attempt.id} className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                      <span className="text-violet-600 font-semibold text-sm">
                        {stats.canShowResults 
                          ? (attempt.final_scores?.overall ?? attempt.total_score ?? 'N/A')
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
                      {attempt.completed_at ? formatTimeAgo(attempt.completed_at) : 'In progress'}
                    </span>
                  </div>
                  )
                })}
                
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