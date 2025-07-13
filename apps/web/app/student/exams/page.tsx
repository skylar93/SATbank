'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { Navigation } from '../../../components/navigation'
import { ExamService, type Exam } from '../../../lib/exam-service'

export default function StudentExamsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadExams()
    }
  }, [user])

  const loadExams = async () => {
    try {
      const activeExams = await ExamService.getActiveExams()
      setExams(activeExams)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeLimit = (timeLimits: any) => {
    const total = timeLimits.english1 + timeLimits.english2 + timeLimits.math1 + timeLimits.math2
    return `${total} minutes total`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading exams...</p>
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
            Available SAT Practice Exams
          </h1>
          <p className="text-gray-600">
            Choose an exam to begin your SAT practice session. Each exam simulates the real test experience.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error loading exams: {error}</p>
          </div>
        )}

        {exams.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Exams Available</h3>
            <p className="text-gray-600 mb-4">
              There are currently no active practice exams. Please check back later or contact your administrator.
            </p>
            <Link
              href="/student/dashboard"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1 max-w-4xl">
            {exams.map((exam) => (
              <div key={exam.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {exam.title}
                      </h3>
                      <p className="text-gray-600 mb-3">
                        {exam.description || 'Complete SAT practice test with all modules'}
                      </p>
                    </div>
                    
                    <div className="flex flex-col items-end space-y-1">
                      {exam.is_mock_exam && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                          Mock Exam
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 p-3 rounded text-center">
                      <div className="text-lg font-semibold text-gray-900">English 1</div>
                      <div className="text-sm text-gray-600">{exam.time_limits.english1} min</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded text-center">
                      <div className="text-lg font-semibold text-gray-900">English 2</div>
                      <div className="text-sm text-gray-600">{exam.time_limits.english2} min</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded text-center">
                      <div className="text-lg font-semibold text-gray-900">Math 1</div>
                      <div className="text-sm text-gray-600">{exam.time_limits.math1} min</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded text-center">
                      <div className="text-lg font-semibold text-gray-900">Math 2</div>
                      <div className="text-sm text-gray-600">{exam.time_limits.math2} min</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-500">
                      <div>Total Questions: {exam.total_questions}</div>
                      <div>Duration: {formatTimeLimit(exam.time_limits)}</div>
                    </div>
                    
                    <Link
                      href={`/student/exam/${exam.id}`}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Start Exam
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-800 mb-2">Important Reminders:</h4>
          <ul className="list-disc list-inside space-y-1 text-yellow-700 text-sm">
            <li>Make sure you have a stable internet connection</li>
            <li>Set aside uninterrupted time for the full exam duration</li>
            <li>You cannot pause or return to previous questions</li>
            <li>The exam will auto-submit when time expires</li>
            <li>Have scratch paper and pencils ready for calculations</li>
          </ul>
        </div>
      </div>
    </div>
  )
}