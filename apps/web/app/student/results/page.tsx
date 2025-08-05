'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { ExamService, type TestAttempt } from '../../../lib/exam-service'
import { StatsCard, ModernScoreProgress } from '../../../components/modern-charts'
import { Calendar } from '../../../components/calendar'
import { 
  ChartBarIcon, 
  TrophyIcon, 
  ClockIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  EyeIcon,
  PlayIcon,
  ArrowTrendingUpIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'

export default function StudentResultsPage() {
  const { user } = useAuth()
  const [attempts, setAttempts] = useState<TestAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingAttempts, setDeletingAttempts] = useState<Set<string>>(new Set())
  const [resultVisibility, setResultVisibility] = useState<Map<string, boolean>>(new Map())

  useEffect(() => {
    if (user) {
      loadAttempts()
    }
  }, [user])

  const loadAttempts = async () => {
    try {
      if (user) {
        const userAttempts = await ExamService.getUserAttempts(user.id)
        
        // Filter out not_started and expired attempts
        const validAttempts = userAttempts.filter(attempt => 
          attempt.status !== 'not_started' && attempt.status !== 'expired'
        )
        
        // Group attempts by exam_id and keep only the most recent in_progress attempt per exam
        const attemptsByExam = new Map<string, TestAttempt[]>()
        
        validAttempts.forEach(attempt => {
          if (!attemptsByExam.has(attempt.exam_id)) {
            attemptsByExam.set(attempt.exam_id, [])
          }
          attemptsByExam.get(attempt.exam_id)!.push(attempt)
        })
        
        const consolidatedAttempts: TestAttempt[] = []
        
        attemptsByExam.forEach((attempts, examId) => {
          // Separate completed and in_progress attempts
          const completedAttempts = attempts.filter(a => a.status === 'completed')
          const inProgressAttempts = attempts.filter(a => a.status === 'in_progress')
          
          // Add all completed attempts
          consolidatedAttempts.push(...completedAttempts)
          
          // Add only the most recent in_progress attempt if any
          if (inProgressAttempts.length > 0) {
            const mostRecentInProgress = inProgressAttempts.sort((a, b) => 
              new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
            )[0]
            consolidatedAttempts.push(mostRecentInProgress)
          }
        })
        
        // Sort by created_at descending
        const sortedAttempts = consolidatedAttempts.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        
        setAttempts(sortedAttempts)
        
        // Check result visibility for each exam
        await checkResultVisibility(sortedAttempts)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const checkResultVisibility = async (attempts: TestAttempt[]) => {
    if (!user) return
    
    const visibilityMap = new Map<string, boolean>()
    
    // Check visibility for each unique exam
    const uniqueExamIds = [...new Set(attempts.filter(a => a.exam_id).map(a => a.exam_id!))]
    
    await Promise.all(
      uniqueExamIds.map(async (examId) => {
        try {
          const canShow = await ExamService.canShowResults(user.id, examId)
          visibilityMap.set(examId, canShow)
        } catch (error) {
          // Default to true for practice mode or if there's an error
          visibilityMap.set(examId, true)
        }
      })
    )
    
    setResultVisibility(visibilityMap)
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

  const handleDeleteAttempt = async (attemptId: string) => {
    if (!confirm('Are you sure you want to discard this exam attempt? This action cannot be undone.')) {
      return
    }

    try {
      setDeletingAttempts(prev => new Set(prev).add(attemptId))
      setError(null)
      
      await ExamService.deleteTestAttempt(attemptId)
      await loadAttempts()
      
    } catch (err: any) {
      console.error('Delete attempt error:', err)
      setError(`Failed to delete attempt: ${err.message || err.toString()}`)
    } finally {
      setDeletingAttempts(prev => {
        const newSet = new Set(prev)
        newSet.delete(attemptId)
        return newSet
      })
    }
  }

  const completedAttempts = attempts.filter(a => a.status === 'completed')
  
  // Helper function to get the display score (prefer final_scores.overall, fallback to total_score)
  const getDisplayScore = (attempt: TestAttempt): number => {
    return attempt.final_scores?.overall || attempt.total_score || 0
  }
  
  // Helper function to check if results can be shown for an attempt
  const canShowAttemptResults = (attempt: TestAttempt): boolean => {
    if (!attempt.exam_id) return true // Practice mode, always show
    return resultVisibility.get(attempt.exam_id) ?? true
  }
  
  // Filter completed attempts that can show results for stats calculation
  const visibleCompletedAttempts = completedAttempts.filter(canShowAttemptResults)
  
  const averageScore = visibleCompletedAttempts.length > 0 
    ? Math.round(visibleCompletedAttempts.reduce((sum, a) => sum + getDisplayScore(a), 0) / visibleCompletedAttempts.length)
    : 0
  const bestScore = visibleCompletedAttempts.length > 0 
    ? Math.max(...visibleCompletedAttempts.map(a => getDisplayScore(a)))
    : 0
  
  // Mock progress data - replace with real data
  const progressData = {
    labels: ['Test 1', 'Test 2', 'Test 3', 'Test 4', 'Test 5'],
    datasets: [
      {
        label: 'Total Score',
        data: visibleCompletedAttempts.slice(-5).map(a => getDisplayScore(a)),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true
      }
    ]
  }

  if (loading) {
    return (
      <div className="h-full bg-gray-50">
        <div className="bg-white px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Results</h1>
              <p className="text-gray-600">Loading your exam results...</p>
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
              <ChartBarIcon className="w-8 h-8 text-white" />
            </div>
            <p className="text-gray-600">Loading results...</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Results</h1>
            <p className="text-gray-600">Review your SAT practice test performance and track progress</p>
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
        {/* Main Grid Layout */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - 9 cols */}
          <div className="col-span-12 lg:col-span-9 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatsCard
                title="Total Exams Taken"
                value={attempts.length}
                change="+2.5%"
                changeType="positive"
                miniChart={{
                  data: [5, 8, 12, 15, 18, attempts.length],
                  color: '#10b981'
                }}
              />
              
              <StatsCard
                title="Best Score"
                value={bestScore ? bestScore : (visibleCompletedAttempts.length < completedAttempts.length ? 'Results Hidden' : 'No scores yet')}
                change="+8.4%"
                changeType="positive"
                miniChart={{
                  data: visibleCompletedAttempts.slice(-6).map(a => getDisplayScore(a)),
                  color: '#8b5cf6'
                }}
              />
              
              <StatsCard
                title="Average Score"
                value={averageScore ? averageScore : (visibleCompletedAttempts.length < completedAttempts.length ? 'Results Hidden' : 'No average yet')}
                change="+5.2%"
                changeType="positive"
                miniChart={{
                  data: visibleCompletedAttempts.length > 0 ? [1200, 1250, 1300, 1350, 1380, averageScore] : [0, 0, 0, 0, 0, 0],
                  color: '#f59e0b'
                }}
              />
            </div>

            {/* Score Progress Chart */}
            {visibleCompletedAttempts.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Score Progress Over Time</h3>
                  <div className="flex items-center space-x-2">
                    <button className="px-3 py-1 text-sm bg-violet-100 text-violet-600 rounded-lg">All Tests</button>
                    <button className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700">Last 5</button>
                  </div>
                </div>
                <ModernScoreProgress data={progressData} />
              </div>
            )}
            
            {/* Message when results are hidden */}
            {completedAttempts.length > 0 && visibleCompletedAttempts.length === 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-orange-500 text-2xl">🔒</span>
                </div>
                <h3 className="text-lg font-semibold text-orange-900 mb-2">Results Currently Hidden</h3>
                <p className="text-orange-700">Your instructor has chosen to hide exam results for now. Results will be available when they are released.</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-red-800">Error loading results: {error}</p>
              </div>
            )}

            {/* Exam Results List */}
            {attempts.length === 0 ? (
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-8 text-center border border-violet-100">
                <div className="w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ChartBarIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Results Yet</h3>
                <p className="text-gray-600 mb-6">
                  You haven't completed any practice exams yet. Take your first exam to see your results here.
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
                  <h3 className="text-lg font-semibold text-gray-900">Recent Exam Attempts</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {attempts.map((attempt) => (
                      <div key={attempt.id} className="border border-gray-200 rounded-xl p-6 hover:border-violet-300 transition-colors">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
                              <AcademicCapIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900">SAT Practice Test</h4>
                              <p className="text-sm text-gray-500">
                                ID: {attempt.id.slice(0, 8)}...
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(attempt.status)}`}>
                              {attempt.status.replace('_', ' ').toUpperCase()}
                            </span>
                            {attempt.status === 'completed' && (
                              <div className="text-right">
                                <div className="text-2xl font-bold text-violet-600">
                                  {canShowAttemptResults(attempt) ? getDisplayScore(attempt) : '***'}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {canShowAttemptResults(attempt) ? 'Total Score' : 'Hidden'}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Module Scores */}
                        {(() => {
                          const canShowResults = canShowAttemptResults(attempt)
                          const finalScores = attempt.final_scores
                          const moduleScores = attempt.module_scores
                          
                          // If we have new final_scores, show English/Math breakdown
                          if (finalScores && finalScores.english && finalScores.math) {
                            return (
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl text-center">
                                  <div className="text-sm font-medium text-gray-900 mb-1">ENGLISH</div>
                                  <div className="text-lg font-bold text-blue-600">
                                    {canShowResults ? finalScores.english : '***'}
                                  </div>
                                </div>
                                <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl text-center">
                                  <div className="text-sm font-medium text-gray-900 mb-1">MATH</div>
                                  <div className="text-lg font-bold text-green-600">
                                    {canShowResults ? finalScores.math : '***'}
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          
                          // Fallback to old module_scores format
                          if (moduleScores) {
                            return (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                {Object.entries(moduleScores).map(([module, score]) => (
                                  <div key={module} className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl text-center">
                                    <div className="text-sm font-medium text-gray-900 mb-1">
                                      {module.replace(/(\d)/, ' $1').toUpperCase()}
                                    </div>
                                    <div className="text-xl font-bold text-gray-700">
                                      {canShowResults ? (score || 0) : '***'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          }
                          
                          return null
                        })()}

                        {/* Action Row */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                          <div className="space-y-1 text-sm text-gray-500">
                            {attempt.started_at && (
                              <div className="flex items-center space-x-1">
                                <CalendarIcon className="w-4 h-4" />
                                <span>Started: {formatDate(attempt.started_at)}</span>
                              </div>
                            )}
                            {attempt.completed_at && (
                              <div className="flex items-center space-x-1">
                                <ClockIcon className="w-4 h-4" />
                                <span>Completed: {formatDate(attempt.completed_at)}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            {attempt.status === 'completed' && (
                              canShowAttemptResults(attempt) ? (
                                <Link
                                  href={`/student/results/${attempt.id}`}
                                  className="inline-flex items-center px-4 py-2 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg font-medium transition-colors"
                                >
                                  <EyeIcon className="w-4 h-4 mr-2" />
                                  View Details
                                </Link>
                              ) : (
                                <div className="inline-flex items-center px-4 py-2 bg-orange-100 text-orange-700 rounded-lg font-medium">
                                  <span className="text-orange-500 mr-2">🔒</span>
                                  Results Hidden
                                </div>
                              )
                            )}
                            
                            {attempt.status === 'in_progress' && attempt.exam_id && (
                              <>
                                <Link
                                  href={`/student/exam/${attempt.exam_id}`}
                                  className="inline-flex items-center px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium transition-colors"
                                >
                                  <PlayIcon className="w-4 h-4 mr-2" />
                                  Continue
                                </Link>
                                <button
                                  onClick={() => handleDeleteAttempt(attempt.id)}
                                  disabled={deletingAttempts.has(attempt.id)}
                                  className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                                    deletingAttempts.has(attempt.id)
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'bg-red-100 hover:bg-red-200 text-red-700'
                                  }`}
                                >
                                  {deletingAttempts.has(attempt.id) ? (
                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 mr-2"></div>
                                  ) : (
                                    <TrashIcon className="w-4 h-4 mr-2" />
                                  )}
                                  {deletingAttempts.has(attempt.id) ? 'Deleting...' : 'Discard'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - 3 cols */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            {/* Calendar */}
            <Calendar events={attempts.filter(a => a.completed_at).map(attempt => ({ 
              date: new Date(attempt.completed_at!), 
              type: 'visit' as const 
            }))} />

            {/* Performance Summary */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Performance Summary</h3>
                <ArrowTrendingUpIcon className="w-5 h-5 text-violet-600" />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-900">Tests Completed</span>
                  <span className="text-lg font-bold text-violet-600">{completedAttempts.length}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-900">Best Score</span>
                  <span className="text-lg font-bold text-green-600">
                    {bestScore ? bestScore : (visibleCompletedAttempts.length < completedAttempts.length ? 'Hidden' : '-')}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-900">Average Score</span>
                  <span className="text-lg font-bold text-orange-600">
                    {averageScore ? averageScore : (visibleCompletedAttempts.length < completedAttempts.length ? 'Hidden' : '-')}
                  </span>
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-sm p-6 text-white">
              <div className="text-center">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <TrophyIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Keep Improving!</h3>
                <p className="text-blue-100 text-sm mb-4">
                  {attempts.length === 0 
                    ? "Start your SAT journey today with your first practice test."
                    : "Continue practicing to reach your target score."
                  }
                </p>
                <Link
                  href="/student/exams"
                  className="bg-white text-blue-600 font-semibold py-2 px-6 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {attempts.length === 0 ? 'Take First Exam' : 'Take Another Exam'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}