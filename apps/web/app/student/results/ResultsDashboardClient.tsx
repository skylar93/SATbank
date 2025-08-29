'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import {
  ExamService,
  type TestAttempt,
  type Exam,
} from '../../../lib/exam-service'
import { ModernScoreProgress } from '../../../components/modern-charts'
import {
  ChartBarIcon,
  TrophyIcon,
  ClockIcon,
  AcademicCapIcon,
  EyeIcon,
  PlayIcon,
  TrashIcon,
  CalendarIcon,
  DocumentTextIcon,
  BoltIcon,
  FlagIcon,
} from '@heroicons/react/24/outline'
import {
  getDisplayScore,
  formatExamDate,
  canShowAttemptResults,
} from '../../../lib/analytics-utils'
import {
  calculateDashboardStats,
  type ResultsDashboardData,
} from '../../../lib/results-service'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '../../../components/ui/card'
import { Progress } from '../../../components/ui/progress'
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
} from '../../../components/ui/table'
import { ExamAttemptRow } from '../../../components/results/ExamAttemptRow'

interface ResultsDashboardClientProps {
  initialData: ResultsDashboardData
}

export default function ResultsDashboardClient({
  initialData,
}: ResultsDashboardClientProps) {
  const { user } = useAuth()
  const [attempts, setAttempts] = useState(initialData.attempts)
  const [resultVisibility] = useState(initialData.resultVisibility)
  const [deletingAttempts, setDeletingAttempts] = useState<Set<string>>(
    new Set()
  )
  const [error, setError] = useState<string | null>(null)

  // Calculate all dashboard statistics
  const stats = calculateDashboardStats(attempts, resultVisibility)

  const handleDeleteAttempt = async (attemptId: string) => {
    if (
      !confirm(
        'Are you sure you want to discard this exam attempt? This action cannot be undone.'
      )
    ) {
      return
    }

    try {
      setDeletingAttempts((prev) => new Set(prev).add(attemptId))
      setError(null)

      await ExamService.deleteTestAttempt(attemptId)

      // Remove the deleted attempt from local state
      setAttempts((prev) => prev.filter((attempt) => attempt.id !== attemptId))
    } catch (err: any) {
      console.error('Delete attempt error:', err)
      setError(`Failed to delete attempt: ${err.message || err.toString()}`)
    } finally {
      setDeletingAttempts((prev) => {
        const newSet = new Set(prev)
        newSet.delete(attemptId)
        return newSet
      })
    }
  }

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Results</h1>
            <p className="text-gray-600">
              Review your SAT practice test performance and track progress
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user?.profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        </div>

        {/* Separator line */}
        <div className="border-b border-gray-200"></div>
      </div>

      <div className="p-6">
        {/* Performance Summary Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Best Score Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg flex items-center justify-center mr-3">
                  <TrophyIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Best Score
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.bestScore || 'No scores yet'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Average Score Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center mr-3">
                  <ChartBarIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Average Score
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.averageScore || 'No average yet'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exams Taken Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-3">
                  <AcademicCapIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Exams Taken
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.totalAttempts}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Target Score Progress Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center mr-3">
                  <FlagIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Target Progress
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {user?.profile?.target_score || 1600}
                  </p>
                </div>
              </div>
              {user?.profile?.target_score && stats.bestScore && (
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>
                      {Math.round(
                        (stats.bestScore / user.profile.target_score) * 100
                      )}
                      %
                    </span>
                  </div>
                  <Progress
                    value={Math.min(
                      (stats.bestScore / user.profile.target_score) * 100,
                      100
                    )}
                    className="h-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Layout */}
        <div className="space-y-6">
          {/* Keep Improving Section - Moved to top */}
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-sm p-6 text-white">
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrophyIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Keep Improving!</h3>
              <p className="text-blue-100 text-sm mb-4">
                {attempts.length === 0
                  ? 'Start your SAT journey today with your first practice test.'
                  : 'Continue practicing to reach your target score.'}
              </p>
              <Link
                href="/student/exams"
                className="bg-white text-blue-600 font-semibold py-2 px-6 rounded-lg hover:bg-blue-50 transition-colors"
              >
                {attempts.length === 0
                  ? 'Take First Exam'
                  : 'Take Another Exam'}
              </Link>
            </div>
          </div>

          {/* Recent Exam Attempts Table */}
          {attempts.length === 0 ? (
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-8 text-center border border-violet-100">
              <div className="w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <ChartBarIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Results Yet
              </h3>
              <p className="text-gray-600 mb-6">
                You haven't completed any practice exams yet. Take your first
                exam to see your results here.
              </p>
              <Link
                href="/student/exams"
                className="inline-flex items-center bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg"
              >
                <AcademicCapIcon className="w-5 h-5 mr-2" />
                Take Your First Exam
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">
                  Recent Exam Attempts
                </h3>
                <p className="text-gray-600 text-sm mt-1">
                  Click on any row to expand and view detailed scores and
                  actions
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status & Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((attempt) => (
                    <ExamAttemptRow
                      key={attempt.id}
                      attempt={attempt}
                      resultVisibility={resultVisibility}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Score Progress Chart */}
          {stats.visibleCompletedAttempts.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  Score Progress Over Time
                </h3>
                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 text-sm bg-violet-100 text-violet-600 rounded-lg">
                    All Tests
                  </button>
                  <button className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">
                    Last 5
                  </button>
                </div>
              </div>
              <ModernScoreProgress data={stats.progressData} />
            </div>
          )}

          {/* Message when results are hidden */}
          {stats.completedAttempts.length > 0 &&
            stats.visibleCompletedAttempts.length === 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-orange-500 text-2xl">🔒</span>
                </div>
                <h3 className="text-lg font-semibold text-orange-900 mb-2">
                  Results Currently Hidden
                </h3>
                <p className="text-orange-700">
                  Your instructor has chosen to hide exam results for now.
                  Results will be available when they are released.
                </p>
              </div>
            )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
