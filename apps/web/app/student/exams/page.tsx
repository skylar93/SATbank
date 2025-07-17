'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { ExamService, type Exam } from '../../../lib/exam-service'
import { StatsCard } from '../../../components/modern-charts'
import { 
  AcademicCapIcon, 
  ClockIcon, 
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  QuestionMarkCircleIcon,
  CheckCircleIcon,
  BoltIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'

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

  const getTotalTime = (timeLimits: any) => {
    return timeLimits.english1 + timeLimits.english2 + timeLimits.math1 + timeLimits.math2
  }

  if (loading) {
    return (
      <div className="h-full bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Take Exam</h1>
              <p className="text-gray-600">Loading available exams...</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user?.profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <AcademicCapIcon className="w-8 h-8 text-white" />
            </div>
            <p className="text-gray-600">Loading exams...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Take Exam</h1>
            <p className="text-gray-600">Choose an exam to begin your SAT practice session</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search exams..."
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user?.profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-800">Error loading exams: {error}</p>
            </div>
          </div>
        )}

        {exams.length === 0 ? (
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-8 text-center border border-violet-100">
            <div className="w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AcademicCapIcon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Exams Available</h3>
            <p className="text-gray-600 mb-6">
              There are currently no active practice exams. Please check back later or contact your administrator.
            </p>
            <Link
              href="/student/dashboard"
              className="inline-flex items-center bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg"
            >
              Return to Dashboard
            </Link>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <StatsCard
                title="Available Exams"
                value={exams.length}
                change="+2.5%"
                changeType="positive"
                miniChart={{
                  data: [2, 3, 4, 5, 6, exams.length],
                  color: '#10b981'
                }}
              />
              
              <StatsCard
                title="Average Duration"
                value={`${Math.round(exams.reduce((sum, exam) => sum + getTotalTime(exam.time_limits), 0) / exams.length)} min`}
                change="+0.8%"
                changeType="positive"
                miniChart={{
                  data: [180, 190, 185, 195, 200, Math.round(exams.reduce((sum, exam) => sum + getTotalTime(exam.time_limits), 0) / exams.length)],
                  color: '#8b5cf6'
                }}
              />
              
              <StatsCard
                title="Total Questions"
                value={`${Math.round(exams.reduce((sum, exam) => sum + exam.total_questions, 0) / exams.length)} avg`}
                change="+12%"
                changeType="positive"
                miniChart={{
                  data: [130, 135, 140, 145, 150, Math.round(exams.reduce((sum, exam) => sum + exam.total_questions, 0) / exams.length)],
                  color: '#f59e0b'
                }}
              />
            </div>

            {/* Featured Exam Card */}
            {exams.length > 0 && (
              <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Ready to Start?</h3>
                    <p className="text-violet-100 mb-6">Take your SAT practice test and track your progress toward your target score.</p>
                    <Link
                      href={`/student/exam/${exams[0].id}`}
                      className="inline-flex items-center bg-white text-violet-600 font-semibold px-6 py-3 rounded-xl hover:bg-violet-50 transition-all duration-200 shadow-lg"
                    >
                      <PlayIcon className="w-5 h-5 mr-2" />
                      Start Practice Test
                    </Link>
                  </div>
                  <div className="hidden lg:block">
                    <div className="w-32 h-32 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                      <AcademicCapIcon className="w-16 h-16 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Exam Cards */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Available Practice Tests</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{exams.length} exams available</span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  {exams.map((exam) => (
                    <div key={exam.id} className="border border-gray-200 rounded-xl p-6 hover:border-violet-300 transition-colors group">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                            <AcademicCapIcon className="w-8 h-8 text-white" />
                          </div>
                          <div>
                            <h4 className="text-xl font-semibold text-gray-900 mb-2">
                              {exam.title}
                            </h4>
                            <p className="text-gray-600">
                              {exam.description || 'Complete SAT practice test with all modules'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end space-y-2">
                          {exam.is_mock_exam && (
                            <span className="bg-gradient-to-r from-violet-100 to-purple-100 text-violet-800 px-3 py-1 rounded-full text-sm font-medium">
                              Mock Exam
                            </span>
                          )}
                          <div className="flex items-center space-x-1 text-sm text-gray-500">
                            <ClockIcon className="w-4 h-4" />
                            <span>{formatTimeLimit(exam.time_limits)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Module Time Breakdown */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl text-center hover:from-blue-100 hover:to-blue-200 transition-colors">
                          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <DocumentTextIcon className="w-4 h-4 text-white" />
                          </div>
                          <div className="text-lg font-semibold text-gray-900">English 1</div>
                          <div className="text-sm text-gray-600">{exam.time_limits.english1} min</div>
                        </div>
                        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl text-center hover:from-green-100 hover:to-green-200 transition-colors">
                          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <DocumentTextIcon className="w-4 h-4 text-white" />
                          </div>
                          <div className="text-lg font-semibold text-gray-900">English 2</div>
                          <div className="text-sm text-gray-600">{exam.time_limits.english2} min</div>
                        </div>
                        <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-xl text-center hover:from-orange-100 hover:to-orange-200 transition-colors">
                          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <BoltIcon className="w-4 h-4 text-white" />
                          </div>
                          <div className="text-lg font-semibold text-gray-900">Math 1</div>
                          <div className="text-sm text-gray-600">{exam.time_limits.math1} min</div>
                        </div>
                        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl text-center hover:from-purple-100 hover:to-purple-200 transition-colors">
                          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                            <BoltIcon className="w-4 h-4 text-white" />
                          </div>
                          <div className="text-lg font-semibold text-gray-900">Math 2</div>
                          <div className="text-sm text-gray-600">{exam.time_limits.math2} min</div>
                        </div>
                      </div>

                      {/* Exam Info and Start Button */}
                      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                        <div className="flex items-center space-x-6">
                          <div className="flex items-center space-x-2">
                            <QuestionMarkCircleIcon className="w-5 h-5 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {exam.total_questions} questions
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <ClockIcon className="w-5 h-5 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {getTotalTime(exam.time_limits)} minutes
                            </span>
                          </div>
                        </div>
                        
                        <Link
                          href={`/student/exam/${exam.id}`}
                          className="inline-flex items-center bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                          <PlayIcon className="w-5 h-5 mr-2" />
                          Start Exam
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Important Reminders */}
            <div className="mt-8 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                  <ExclamationTriangleIcon className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-amber-800">Important Reminders</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-amber-600" />
                    <span className="text-amber-700 text-sm">Ensure stable internet connection</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-amber-600" />
                    <span className="text-amber-700 text-sm">Set aside uninterrupted time</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-amber-600" />
                    <span className="text-amber-700 text-sm">Have scratch paper ready</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-amber-600" />
                    <span className="text-amber-700 text-sm">Cannot pause or go back</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-amber-600" />
                    <span className="text-amber-700 text-sm">Auto-submit when time expires</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-amber-600" />
                    <span className="text-amber-700 text-sm">Use approved calculator</span>
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