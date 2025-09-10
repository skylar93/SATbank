'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../../contexts/auth-context'
import { ExamService, type Exam } from '../../../../lib/exam-service'
import { deleteInProgressExamAttempt } from '../../../../lib/exam-actions'
import { StatsCard } from '../../../../components/modern-charts'
import {
  AcademicCapIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  QuestionMarkCircleIcon,
  CheckCircleIcon,
  BoltIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  EyeIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

type ExamWithStatus = Exam & {
  completionStatus: 'not_started' | 'in_progress' | 'completed'
  completedAttemptId?: string
  isCurrentlyAssigned?: boolean
}

export default function StudentExamsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [exams, setExams] = useState<ExamWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCompletedExams, setShowCompletedExams] = useState(true)
  const [deletingExams, setDeletingExams] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (user) {
      loadExams()
    }
  }, [user])

  const loadExams = async () => {
    try {
      if (!user?.id) return

      // Get all available exams with completion status
      const availableExams = await ExamService.getAvailableExamsWithStatus(
        user.id
      )
      setExams(availableExams)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteInProgressExam = async (examId: string) => {
    if (!confirm('정말로 진행 중인 시험을 삭제하시겠습니까? 지금까지의 답안이 모두 사라집니다.')) {
      return
    }

    setDeletingExams(prev => new Set(prev).add(examId))
    
    try {
      const result = await deleteInProgressExamAttempt(examId)
      
      if (result.success) {
        // Reload exams to reflect changes
        await loadExams()
      } else {
        setError(result.message || 'Failed to delete exam attempt')
      }
    } catch (err: any) {
      setError(`Error deleting exam: ${err.message}`)
    } finally {
      setDeletingExams(prev => {
        const newSet = new Set(prev)
        newSet.delete(examId)
        return newSet
      })
    }
  }

  const formatTimeLimit = (timeLimits: any) => {
    const total =
      timeLimits.english1 +
      timeLimits.english2 +
      timeLimits.math1 +
      timeLimits.math2
    return `${total} minutes total`
  }

  const getTotalTime = (timeLimits: any) => {
    return (
      timeLimits.english1 +
      timeLimits.english2 +
      timeLimits.math1 +
      timeLimits.math2
    )
  }

  // Filter exams by completion status
  const activeExams = exams.filter(
    (exam) => exam.completionStatus !== 'completed'
  )
  const completedExams = exams.filter(
    (exam) => exam.completionStatus === 'completed'
  )

  if (loading) {
    return (
      <div className="h-full bg-gray-50">
        <div className="bg-white px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Assigned Exams
              </h1>
              <p className="text-gray-600">Loading your assigned exams...</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user?.profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
          <div className="border-b border-gray-200"></div>
        </div>
        <div className="p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <AcademicCapIcon className="w-8 h-8 text-white" />
            </div>
            <p className="text-gray-600">Loading assigned exams...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header Section */}
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Assigned Exams</h1>
            <p className="text-gray-600">
              Take the exams that have been assigned to you
            </p>
          </div>
          <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold">
              {user?.profile?.full_name?.charAt(0) || 'U'}
            </span>
          </div>
        </div>

        {/* Separator line */}
        <div className="border-b border-gray-200"></div>
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

        {activeExams.length === 0 && completedExams.length === 0 ? (
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-8 text-center border border-violet-100">
            <div className="w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AcademicCapIcon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Assigned Exams
            </h3>
            <p className="text-gray-600 mb-6">
              You don't have any assigned exams at the moment. Please wait for
              your administrator to assign exams to you.
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
            {/* Featured Exam Card - Only show if there are active exams */}
            {activeExams.length > 0 && (
              <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Ready to Start?</h3>
                    <p className="text-violet-100 mb-6">
                      Take your SAT practice test and track your progress toward
                      your target score.
                    </p>
                    <Link
                      href={`/student/exam/${activeExams[0].id}`}
                      className="inline-flex items-center bg-white text-violet-600 font-semibold px-6 py-3 rounded-xl hover:bg-violet-50 transition-all duration-200 shadow-lg"
                    >
                      <PlayIcon className="w-5 h-5 mr-2" />
                      {activeExams[0].completionStatus === 'in_progress'
                        ? 'Continue Exam'
                        : 'Start Practice Test'}
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

            {/* Active Assignments Section */}
            {activeExams.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Active Assignments
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {activeExams.length} exam
                        {activeExams.length !== 1 ? 's' : ''} to complete
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    {activeExams.map((exam) => (
                      <div
                        key={exam.id}
                        className="border border-gray-200 rounded-xl p-6 hover:border-violet-300 transition-colors group"
                      >
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
                                {exam.description ||
                                  'Complete SAT practice test with all modules'}
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
                          <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-4 rounded-xl text-center hover:from-indigo-100 hover:to-indigo-200 transition-colors">
                            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                              <DocumentTextIcon className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-lg font-semibold text-gray-900">
                              English 1
                            </div>
                            <div className="text-sm text-gray-600">
                              {exam.time_limits.english1} min
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-violet-50 to-violet-100 p-4 rounded-xl text-center hover:from-violet-100 hover:to-violet-200 transition-colors">
                            <div className="w-8 h-8 bg-violet-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                              <DocumentTextIcon className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-lg font-semibold text-gray-900">
                              English 2
                            </div>
                            <div className="text-sm text-gray-600">
                              {exam.time_limits.english2} min
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl text-center hover:from-purple-100 hover:to-purple-200 transition-colors">
                            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                              <BoltIcon className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-lg font-semibold text-gray-900">
                              Math 1
                            </div>
                            <div className="text-sm text-gray-600">
                              {exam.time_limits.math1} min
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-pink-50 to-pink-100 p-4 rounded-xl text-center hover:from-pink-100 hover:to-pink-200 transition-colors">
                            <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                              <BoltIcon className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-lg font-semibold text-gray-900">
                              Math 2
                            </div>
                            <div className="text-sm text-gray-600">
                              {exam.time_limits.math2} min
                            </div>
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

                          <div className="flex space-x-3">
                            <Link
                              href={`/student/exam/${exam.id}`}
                              className="inline-flex items-center bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                            >
                              <PlayIcon className="w-5 h-5 mr-2" />
                              {exam.completionStatus === 'in_progress'
                                ? 'Continue Exam'
                                : 'Start Exam'}
                            </Link>
                            
                            {exam.completionStatus === 'in_progress' && (
                              <button
                                onClick={() => handleDeleteInProgressExam(exam.id)}
                                disabled={deletingExams.has(exam.id)}
                                className="inline-flex items-center bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-4 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
                                title="진행 중인 시험 삭제"
                              >
                                {deletingExams.has(exam.id) ? (
                                  <div className="w-5 h-5 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <TrashIcon className="w-5 h-5 mr-2" />
                                )}
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Completed Assignments Section */}
            {completedExams.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
                <div
                  className="p-6 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setShowCompletedExams(!showCompletedExams)}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-700">
                      Completed Assignments
                    </h3>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-500">
                        {completedExams.length} completed exam
                        {completedExams.length !== 1 ? 's' : ''}
                      </span>
                      <ChevronDownIcon
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          showCompletedExams ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {showCompletedExams && (
                  <div className="p-6">
                    <div className="space-y-6">
                      {completedExams.map((exam) => (
                        <div
                          key={exam.id}
                          className="border border-gray-200 rounded-xl p-6 bg-gray-50 hover:bg-gray-100 transition-colors group opacity-75"
                        >
                          <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center space-x-4">
                              <div className="w-16 h-16 bg-gray-400 rounded-2xl flex items-center justify-center group-hover:bg-gray-500 transition-colors">
                                <CheckCircleIcon className="w-8 h-8 text-white" />
                              </div>
                              <div>
                                <h4 className="text-xl font-semibold text-gray-700 mb-2">
                                  {exam.title}
                                </h4>
                                <p className="text-gray-600">
                                  {exam.description ||
                                    'Complete SAT practice test with all modules'}
                                </p>
                                <div className="flex items-center space-x-2 mt-2">
                                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                                  <span className="text-sm text-green-600 font-medium">
                                    Completed
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end space-y-2">
                              {exam.is_mock_exam && (
                                <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                                  Mock Exam
                                </span>
                              )}
                              <div className="flex items-center space-x-1 text-sm text-gray-500">
                                <ClockIcon className="w-4 h-4" />
                                <span>{formatTimeLimit(exam.time_limits)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Module Time Breakdown - Simplified for completed exams */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="bg-gray-200 p-4 rounded-xl text-center">
                              <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                                <DocumentTextIcon className="w-4 h-4 text-white" />
                              </div>
                              <div className="text-lg font-semibold text-gray-700">
                                English 1
                              </div>
                              <div className="text-sm text-gray-600">
                                {exam.time_limits.english1} min
                              </div>
                            </div>
                            <div className="bg-gray-200 p-4 rounded-xl text-center">
                              <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                                <DocumentTextIcon className="w-4 h-4 text-white" />
                              </div>
                              <div className="text-lg font-semibold text-gray-700">
                                English 2
                              </div>
                              <div className="text-sm text-gray-600">
                                {exam.time_limits.english2} min
                              </div>
                            </div>
                            <div className="bg-gray-200 p-4 rounded-xl text-center">
                              <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                                <BoltIcon className="w-4 h-4 text-white" />
                              </div>
                              <div className="text-lg font-semibold text-gray-700">
                                Math 1
                              </div>
                              <div className="text-sm text-gray-600">
                                {exam.time_limits.math1} min
                              </div>
                            </div>
                            <div className="bg-gray-200 p-4 rounded-xl text-center">
                              <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center mx-auto mb-2">
                                <BoltIcon className="w-4 h-4 text-white" />
                              </div>
                              <div className="text-lg font-semibold text-gray-700">
                                Math 2
                              </div>
                              <div className="text-sm text-gray-600">
                                {exam.time_limits.math2} min
                              </div>
                            </div>
                          </div>

                          {/* Exam Info and View Results Button */}
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

                            {exam.completedAttemptId && (
                              <div className="flex space-x-3">
                                <Link
                                  href={`/student/results/${exam.completedAttemptId}`}
                                  className="inline-flex items-center bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                                >
                                  <EyeIcon className="w-5 h-5 mr-2" />
                                  View Results
                                </Link>
                                <Link
                                  href={`/student/exam/${exam.id}`}
                                  className="inline-flex items-center bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                                >
                                  <PlayIcon className="w-5 h-5 mr-2" />
                                  Try Again
                                </Link>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Important Reminders */}
            <div className="mt-8 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center">
                  <ExclamationTriangleIcon className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-violet-800">
                  Important Reminders
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-violet-600" />
                    <span className="text-violet-700 text-sm">
                      Ensure stable internet connection
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-violet-600" />
                    <span className="text-violet-700 text-sm">
                      Set aside uninterrupted time
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-violet-600" />
                    <span className="text-violet-700 text-sm">
                      Have scratch paper ready
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-violet-600" />
                    <span className="text-violet-700 text-sm">
                      Cannot pause or go back
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-violet-600" />
                    <span className="text-violet-700 text-sm">
                      Auto-submit when time expires
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-5 h-5 text-violet-600" />
                    <span className="text-violet-700 text-sm">
                      Use approved calculator
                    </span>
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
