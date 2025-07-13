'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { Navigation } from '../../../components/navigation'
import { ExamService, type TestAttempt } from '../../../lib/exam-service'

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
        const dashboardStats = await ExamService.getDashboardStats(user.id)
        setStats(dashboardStats)
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

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {user.profile?.full_name?.split(' ')[0]}!
            </h1>
            <p className="mt-2 text-gray-600">
              Ready to continue your SAT preparation?
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{loading ? '-' : stats.examsTaken}</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Exams Taken
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">{loading ? 'Loading...' : stats.examsTaken}</dd>
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
                      <span className="text-white text-sm font-bold">
                        {loading ? '-' : stats.bestScore ? Math.floor(stats.bestScore / 100) : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Best Score
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {loading ? 'Loading...' : stats.bestScore ? stats.bestScore : 'Not yet taken'}
                      </dd>
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
                      <span className="text-white text-sm font-bold">
                        {user.profile?.target_score ? Math.floor(user.profile.target_score / 100) : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Target Score
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {user.profile?.target_score || 'Not set'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Take Mock Exam
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Take a full-length SAT practice test with all 4 modules. 
                  This simulates the real exam experience.
                </p>
                <Link href="/student/exams" className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors text-center">
                  Start Mock Exam
                </Link>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Problem Bank
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Practice with targeted questions, review mistakes, and create custom quizzes.
                </p>
                <Link href="/student/problem-bank" className="block w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-medium transition-colors text-center">
                  Browse Questions
                </Link>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  View Results
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Review your exam performance and track your progress over time.
                </p>
                <Link href="/student/results" className="block w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium transition-colors text-center">
                  View Results
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mt-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Recent Activity
                </h3>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                    </div>
                  </div>
                ) : stats.recentAttempts.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No recent activity yet.</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Take your first exam to see your progress here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stats.recentAttempts.map((attempt) => (
                      <div key={attempt.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {attempt.total_score}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">SAT Practice Test</p>
                            <p className="text-sm text-gray-500">
                              {attempt.completed_at ? formatDate(attempt.completed_at) : 'In Progress'}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/student/results/${attempt.id}`}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          View Details
                        </Link>
                      </div>
                    ))}
                    {stats.recentAttempts.length > 0 && (
                      <div className="text-center pt-4">
                        <Link
                          href="/student/results"
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          View All Results →
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}