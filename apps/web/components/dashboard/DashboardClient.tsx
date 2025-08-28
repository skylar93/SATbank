'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../../contexts/auth-context'
import { type TestAttempt } from '../../lib/exam-service'
import {
  ProgressChart,
  SubjectPerformanceChart,
  WeeklyActivityChart,
  CircularProgress,
} from '../charts'
import {
  ModernScoreProgress,
  StatsCard,
} from '../modern-charts'
import { Calendar } from '../calendar'
import SmartReviewWidget from './SmartReviewWidget'
import {
  ChartBarIcon,
  FireIcon,
} from '@heroicons/react/24/outline'
import { formatTimeAgo } from '../../lib/utils'

interface DashboardData {
  overallStats: {
    examsTaken: number
    bestScore: number | null
    averageScore: number | null
  }
  scoreHistory: Array<{
    date: string
    score: number
  }>
  recentAttempts: TestAttempt[]
  previousMonthStats: {
    examsTaken: number
    bestScore: number | null
    averageScore: number | null
  }
  activityDays: string[]
  weeklyActivity: {
    days: string[]
    studyTime: number[]
    practiceTests: number[]
  }
  subjectScores: {
    reading: number
    writing: number
    math: number
  }
}

interface DashboardClientProps {
  initialData?: DashboardData
  canShowResults?: boolean
}

export default function DashboardClient({ initialData, canShowResults = true }: DashboardClientProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(!initialData)
  
  // Apply impersonation padding immediately on mount
  useEffect(() => {
    const checkImpersonation = () => {
      if (typeof window !== 'undefined') {
        const impersonationData = localStorage.getItem('impersonation_data');
        if (impersonationData) {
          document.body.style.setProperty('padding-top', '44px', 'important');
          document.body.classList.add('impersonation-active');
        }
      }
    };
    
    checkImpersonation();
  }, []);

  // Use initial data or fallback to empty state
  const data = initialData || {
    overallStats: { examsTaken: 0, bestScore: null, averageScore: null },
    scoreHistory: [],
    recentAttempts: [],
    previousMonthStats: { examsTaken: 0, bestScore: null, averageScore: null },
    activityDays: [],
    weeklyActivity: {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      studyTime: [0, 0, 0, 0, 0, 0, 0],
      practiceTests: [0, 0, 0, 0, 0, 0, 0],
    },
    subjectScores: { reading: 0, writing: 0, math: 0 },
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const calculatePercentageChange = (
    current: number | null,
    previous: number | null
  ): { change: string; isZero: boolean } => {
    if (!current || !previous || previous === 0) {
      return { change: '0%', isZero: true }
    }
    const change = ((current - previous) / previous) * 100
    const prefix = change >= 0 ? '+' : ''
    return { change: `${prefix}${change.toFixed(1)}%`, isZero: false }
  }

  // Real data for score progress chart with fallback for empty data
  const hasScoreData = data.scoreHistory.length > 0
  const progressData = hasScoreData
    ? {
        labels: data.scoreHistory.map((item) => {
          const date = new Date(item.date)
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        }),
        datasets: [
          {
            label: 'Overall Score',
            data: data.scoreHistory.map((item) => item.score),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
          },
        ],
      }
    : {
        labels: ['Take your first exam'],
        datasets: [
          {
            label: 'Overall Score',
            data: [0],
            borderColor: '#e5e7eb',
            backgroundColor: 'rgba(229, 231, 235, 0.1)',
            fill: true,
          },
        ],
      }

  if (!user) return null

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-4 md:px-6 py-4 md:py-6">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              Dashboard
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Hello {user.profile?.full_name?.split(' ')[0] || 'there'}, welcome back
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm md:text-base">
                {user.profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        </div>

        {/* Separator line */}
        <div className="border-b border-gray-200"></div>
      </div>

      <div className="p-4 md:p-6">
        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          {/* Left Column - 9 cols */}
          <div className="lg:col-span-9 space-y-4 md:space-y-6">
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <StatsCard
                title="Your Score This Month"
                value={
                  loading
                    ? '...'
                    : !canShowResults
                      ? 'Results Hidden'
                      : data.overallStats.bestScore || 'No scores yet'
                }
                change={(() => {
                  const result = calculatePercentageChange(
                    data.overallStats.bestScore,
                    data.previousMonthStats.bestScore
                  )
                  return result.change
                })()}
                changeType={(() => {
                  const result = calculatePercentageChange(
                    data.overallStats.bestScore,
                    data.previousMonthStats.bestScore
                  )
                  if (result.isZero) return 'neutral'
                  return data.overallStats.bestScore &&
                    data.previousMonthStats.bestScore &&
                    data.overallStats.bestScore >= data.previousMonthStats.bestScore
                    ? 'positive'
                    : 'negative'
                })()}
                miniChart={{
                  data:
                    canShowResults && data.scoreHistory.length > 0
                      ? data.scoreHistory.slice(-6).map((item) => item.score)
                      : [0, 0, 0, 0, 0, 0],
                  color: '#10b981',
                }}
              />

              <StatsCard
                title="Total Exams"
                value={data.overallStats.examsTaken}
                change={(() => {
                  const result = calculatePercentageChange(
                    data.overallStats.examsTaken,
                    data.previousMonthStats.examsTaken
                  )
                  return result.change
                })()}
                changeType={(() => {
                  const result = calculatePercentageChange(
                    data.overallStats.examsTaken,
                    data.previousMonthStats.examsTaken
                  )
                  if (result.isZero) return 'neutral'
                  return data.overallStats.examsTaken >= data.previousMonthStats.examsTaken
                    ? 'positive'
                    : 'negative'
                })()}
                miniChart={{
                  data: Array.from({ length: 6 }, (_, i) =>
                    Math.max(0, data.overallStats.examsTaken - 5 + i)
                  ),
                  color: '#8b5cf6',
                }}
              />

              <StatsCard
                title="Average Score"
                value={
                  loading
                    ? '...'
                    : !canShowResults
                      ? 'Results Hidden'
                      : data.overallStats.averageScore || 'No scores yet'
                }
                change={(() => {
                  const result = calculatePercentageChange(
                    data.overallStats.averageScore,
                    data.previousMonthStats.averageScore
                  )
                  return result.change
                })()}
                changeType={(() => {
                  const result = calculatePercentageChange(
                    data.overallStats.averageScore,
                    data.previousMonthStats.averageScore
                  )
                  if (result.isZero) return 'neutral'
                  return data.overallStats.averageScore &&
                    data.previousMonthStats.averageScore &&
                    data.overallStats.averageScore >= data.previousMonthStats.averageScore
                    ? 'positive'
                    : 'negative'
                })()}
                miniChart={{
                  data:
                    canShowResults && data.scoreHistory.length > 0
                      ? data.scoreHistory.slice(-6).map((item) => item.score)
                      : [0, 0, 0, 0, 0, 0],
                  color: '#f59e0b',
                }}
              />
            </div>

            {/* Score Progress Chart - Full Width */}
            <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 space-y-2 sm:space-y-0">
                <h3 className="text-lg font-semibold text-gray-900">
                  Score Progress
                </h3>
                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 text-sm bg-violet-100 text-violet-600 rounded-lg">
                    This Week
                  </button>
                  <button className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">
                    Last Week
                  </button>
                </div>
              </div>
              {!canShowResults ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                    <ChartBarIcon className="w-8 h-8 text-orange-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Results Currently Hidden
                  </h4>
                  <p className="text-gray-500 text-sm mb-4">
                    Your instructor has chosen to hide exam results for now.
                  </p>
                </div>
              ) : hasScoreData ? (
                <ModernScoreProgress data={progressData} />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <ChartBarIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    No Score History Yet
                  </h4>
                  <p className="text-gray-500 text-sm mb-4">
                    Take your first practice exam to see your progress over
                    time.
                  </p>
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
            <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 md:mb-6">
                Subject Performance
              </h3>
              <SubjectPerformanceChart data={data.subjectScores} />
            </div>

            {/* Weekly Activity */}
            <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-6 space-y-2 sm:space-y-0">
                <h3 className="text-lg font-semibold text-gray-900">
                  Weekly Activity
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">This Week</span>
                  <select className="text-sm border border-gray-300 rounded-lg px-2 py-1">
                    <option>This Week</option>
                    <option>Last Week</option>
                    <option>This Month</option>
                  </select>
                </div>
              </div>
              <WeeklyActivityChart data={data.weeklyActivity} />
            </div>
          </div>

          {/* Right Column - 3 cols */}
          <div className="lg:col-span-3 space-y-4 md:space-y-6">
            {/* Smart Review Widget */}
            <SmartReviewWidget />

            {/* Calendar */}
            <Calendar
              events={data.activityDays.map((date) => ({
                date: new Date(date),
                type: 'visit' as const,
              }))}
            />

            {/* Performance Summary */}
            <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Performance Summary
                </h3>
                <button className="text-sm text-gray-500 hover:text-gray-700">
                  Update
                </button>
              </div>

              <div className="flex justify-center mb-4 md:mb-6">
                <CircularProgress
                  percentage={
                    canShowResults && data.overallStats.bestScore
                      ? Math.round((data.overallStats.bestScore / 1600) * 100)
                      : 0
                  }
                  size={120}
                />
              </div>

              <div className="space-y-3">
                {!canShowResults ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">Results Hidden</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Your instructor will release results when ready
                    </p>
                  </div>
                ) : data.overallStats.bestScore ? (
                  <>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-violet-500"></div>
                      <span className="text-sm text-gray-700">Best Score</span>
                      <span className="ml-auto text-sm font-semibold">
                        {data.overallStats.bestScore}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                      <span className="text-sm text-gray-700">Exams Taken</span>
                      <span className="ml-auto text-sm font-semibold">
                        {data.overallStats.examsTaken}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm text-gray-700">
                        Average Score
                      </span>
                      <span className="ml-auto text-sm font-semibold">
                        {data.overallStats.averageScore || 'N/A'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">No exam data yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Take your first exam to see performance here
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Latest Activities */}
            <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Latest Activities
                </h3>
                <button className="text-sm text-violet-600 hover:text-violet-700 font-medium">
                  View all
                </button>
              </div>

              <div className="space-y-4">
                {data.recentAttempts.slice(0, 3).map((attempt, index) => {
                  return (
                    <div
                      key={attempt.id}
                      className="flex items-center space-x-3"
                    >
                      <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                        <span className="text-violet-600 font-semibold text-sm">
                          {canShowResults
                            ? (attempt.final_scores?.overall ??
                              attempt.total_score ??
                              'N/A')
                            : '***'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          SAT Practice Test
                        </p>
                        <p className="text-xs text-gray-500">
                          {attempt.completed_at
                            ? formatDate(attempt.completed_at)
                            : 'In Progress'}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {attempt.completed_at
                          ? formatTimeAgo(attempt.completed_at)
                          : 'In progress'}
                      </span>
                    </div>
                  )
                })}

                {data.recentAttempts.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">No recent activity</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Take your first exam to see progress here
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Call to Action */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-sm p-4 md:p-6 text-white">
              <div className="text-center">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4">
                  <FireIcon className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <h3 className="text-base md:text-lg font-semibold mb-2">
                  Keep Your Streak!
                </h3>
                <p className="text-blue-100 text-sm mb-3 md:mb-4">
                  You're doing great! Continue your daily practice to reach your
                  target score.
                </p>
                <button className="bg-white text-blue-600 font-semibold py-2 px-4 md:px-6 rounded-lg hover:bg-blue-50 transition-colors text-sm md:text-base">
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