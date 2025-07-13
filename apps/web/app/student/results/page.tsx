'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { Navigation } from '../../../components/navigation'
import { ExamService, type TestAttempt } from '../../../lib/exam-service'

export default function StudentResultsPage() {
  const { user } = useAuth()
  const [attempts, setAttempts] = useState<TestAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadAttempts()
    }
  }, [user])

  const loadAttempts = async () => {
    try {
      if (user) {
        const userAttempts = await ExamService.getUserAttempts(user.id)
        setAttempts(userAttempts)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const calculateTotalScore = (moduleScores: any) => {
    if (!moduleScores) return 0
    return Object.values(moduleScores).reduce((sum: number, score: any) => sum + (score || 0), 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading results...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your Exam Results
          </h1>
          <p className="text-gray-600">
            Review your SAT practice test performance and track your progress over time.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error loading results: {error}</p>
          </div>
        )}

        {attempts.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
            <p className="text-gray-600 mb-4">
              You haven't completed any practice exams yet. Take your first exam to see your results here.
            </p>
            <Link
              href="/student/exams"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Take an Exam
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {attempts.map((attempt) => (
              <div key={attempt.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      SAT Practice Test
                    </h3>
                    <p className="text-sm text-gray-500">
                      Attempt ID: {attempt.id.slice(0, 8)}...
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(attempt.status)}`}>
                      {attempt.status.replace('_', ' ').toUpperCase()}
                    </span>
                    {attempt.status === 'completed' && (
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {attempt.total_score}
                        </div>
                        <div className="text-sm text-gray-500">Total Score</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {attempt.module_scores && Object.entries(attempt.module_scores).map(([module, score]) => (
                    <div key={module} className="bg-gray-50 p-3 rounded text-center">
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        {module.replace(/(\d)/, ' $1').toUpperCase()}
                      </div>
                      <div className="text-lg font-semibold text-gray-700">
                        {score || 0}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 text-sm text-gray-500">
                  <div className="space-y-1">
                    {attempt.started_at && (
                      <div>Started: {formatDate(attempt.started_at)}</div>
                    )}
                    {attempt.completed_at && (
                      <div>Completed: {formatDate(attempt.completed_at)}</div>
                    )}
                  </div>
                  
                  {attempt.status === 'completed' && (
                    <div className="text-right">
                      <Link
                        href={`/student/results/${attempt.id}`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View Detailed Results
                      </Link>
                    </div>
                  )}
                  
                  {attempt.status === 'in_progress' && (
                    <div className="text-right">
                      <Link
                        href={`/student/exam/${attempt.exam_id}`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Continue Exam
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {attempts.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/student/exams"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Take Another Exam
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}