'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/auth-context'
import { createClient } from '../../lib/supabase'
import { ProgressChart } from '../charts/progress-chart'

interface PracticeStats {
  totalPracticeSessions: number
  totalQuestionsAnswered: number
  averageAccuracy: number
  timeSpentHours: number
  strongestTopics: Array<{ topic: string; accuracy: number; count: number }>
  weakestTopics: Array<{ topic: string; accuracy: number; count: number }>
  recentSessions: Array<{
    id: string
    completed_at: string
    total_score: number
    question_count: number
    time_spent: number
    module_focus?: string
  }>
  accuracyTrend: Array<{
    date: string
    accuracy: number
    questionsAnswered: number
  }>
  topicProgress: Array<{
    topic: string
    totalQuestions: number
    correctAnswers: number
    accuracy: number
    recentAccuracy: number
    trend: 'improving' | 'declining' | 'stable'
  }>
}

interface PracticeProgressProps {
  timeframe?: 'week' | 'month' | 'all'
  showDetailedStats?: boolean
}

export function PracticeProgress({
  timeframe = 'month',
  showDetailedStats = true,
}: PracticeProgressProps) {
  const { user } = useAuth()
  const supabase = createClient()
  const [stats, setStats] = useState<PracticeStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchPracticeStats()
    }
  }, [user, timeframe])

  const fetchPracticeStats = async () => {
    try {
      setLoading(true)

      // Calculate date range based on timeframe
      const now = new Date()
      let dateFilter = ''

      switch (timeframe) {
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          dateFilter = weekAgo.toISOString()
          break
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          dateFilter = monthAgo.toISOString()
          break
        case 'all':
        default:
          dateFilter = '1970-01-01T00:00:00.000Z'
          break
      }

      // Fetch practice sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('test_attempts')
        .select(
          `
          id,
          completed_at,
          total_score,
          time_spent,
          user_answers (
            id,
            is_correct,
            time_spent_seconds,
            questions (
              topic_tags,
              module_type,
              difficulty_level
            )
          )
        `
        )
        .eq('user_id', user?.id)
        .eq('is_practice_mode', true)
        .eq('status', 'completed')
        .gte('completed_at', dateFilter)
        .order('completed_at', { ascending: false })

      if (sessionsError) throw sessionsError

      // Process sessions data
      const processedStats = await processPracticeData(sessions || [])
      setStats(processedStats)
    } catch (error) {
      console.error('Error fetching practice stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const processPracticeData = async (
    sessions: any[]
  ): Promise<PracticeStats> => {
    // Basic stats
    const totalPracticeSessions = sessions.length
    const totalQuestionsAnswered = sessions.reduce(
      (sum, session) => sum + (session.user_answers?.length || 0),
      0
    )
    const totalCorrect = sessions.reduce(
      (sum, session) =>
        sum +
        (session.user_answers?.filter((a: any) => a.is_correct).length || 0),
      0
    )
    const averageAccuracy =
      totalQuestionsAnswered > 0
        ? (totalCorrect / totalQuestionsAnswered) * 100
        : 0

    const totalTimeSpentSeconds = sessions.reduce((sum, session) => {
      if (session.time_spent?.total) return sum + session.time_spent.total
      return (
        sum +
        (session.user_answers?.reduce(
          (timeSum: number, answer: any) =>
            timeSum + (answer.time_spent_seconds || 0),
          0
        ) || 0)
      )
    }, 0)
    const timeSpentHours = totalTimeSpentSeconds / 3600

    // Topic analysis
    const topicStats = new Map<
      string,
      { total: number; correct: number; recent: number; recentCorrect: number }
    >()
    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days

    sessions.forEach((session) => {
      const isRecent = new Date(session.completed_at) > recentCutoff

      session.user_answers?.forEach((answer: any) => {
        answer.questions?.topic_tags?.forEach((topic: string) => {
          if (!topicStats.has(topic)) {
            topicStats.set(topic, {
              total: 0,
              correct: 0,
              recent: 0,
              recentCorrect: 0,
            })
          }

          const stats = topicStats.get(topic)!
          stats.total++
          if (answer.is_correct) stats.correct++

          if (isRecent) {
            stats.recent++
            if (answer.is_correct) stats.recentCorrect++
          }
        })
      })
    })

    // Convert to arrays and sort
    const topicArray = Array.from(topicStats.entries())
      .map(([topic, stats]) => {
        const overallAccuracy = (stats.correct / stats.total) * 100
        const recentAccuracy =
          stats.recent > 0 ? (stats.recentCorrect / stats.recent) * 100 : 0

        return {
          topic,
          totalQuestions: stats.total,
          correctAnswers: stats.correct,
          accuracy: overallAccuracy,
          recentAccuracy,
          trend:
            stats.recent > 0
              ? recentAccuracy > overallAccuracy
                ? ('improving' as const)
                : recentAccuracy < overallAccuracy
                  ? ('declining' as const)
                  : ('stable' as const)
              : ('stable' as const),
        }
      })
      .filter((t) => t.totalQuestions >= 3) // Only include topics with at least 3 questions

    const strongestTopics = topicArray
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 5)
      .map((t) => ({
        topic: t.topic,
        accuracy: t.accuracy,
        count: t.totalQuestions,
      }))

    const weakestTopics = topicArray
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5)
      .map((t) => ({
        topic: t.topic,
        accuracy: t.accuracy,
        count: t.totalQuestions,
      }))

    // Recent sessions
    const recentSessions = sessions.slice(0, 10).map((session) => ({
      id: session.id,
      completed_at: session.completed_at,
      total_score: session.total_score || 0,
      question_count: session.user_answers?.length || 0,
      time_spent: session.time_spent?.total || 0,
      module_focus: getMostFrequentModule(session.user_answers),
    }))

    // Accuracy trend (daily for last 30 days)
    const accuracyTrend = generateAccuracyTrend(sessions)

    return {
      totalPracticeSessions,
      totalQuestionsAnswered,
      averageAccuracy,
      timeSpentHours,
      strongestTopics,
      weakestTopics,
      recentSessions,
      accuracyTrend,
      topicProgress: topicArray,
    }
  }

  const getMostFrequentModule = (answers: any[]) => {
    if (!answers || answers.length === 0) return undefined

    const moduleCounts = new Map<string, number>()
    answers.forEach((answer) => {
      const module = answer.questions?.module_type
      if (module) {
        moduleCounts.set(module, (moduleCounts.get(module) || 0) + 1)
      }
    })

    const mostFrequent = Array.from(moduleCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0]

    return mostFrequent ? formatModuleName(mostFrequent[0]) : undefined
  }

  const formatModuleName = (module: string) => {
    switch (module) {
      case 'english1':
        return 'English 1'
      case 'english2':
        return 'English 2'
      case 'math1':
        return 'Math 1'
      case 'math2':
        return 'Math 2'
      default:
        return module
    }
  }

  const generateAccuracyTrend = (sessions: any[]) => {
    const dailyStats = new Map<string, { correct: number; total: number }>()

    sessions.forEach((session) => {
      const date = new Date(session.completed_at).toISOString().split('T')[0]
      if (!dailyStats.has(date)) {
        dailyStats.set(date, { correct: 0, total: 0 })
      }

      const dayStats = dailyStats.get(date)!
      const correct =
        session.user_answers?.filter((a: any) => a.is_correct).length || 0
      const total = session.user_answers?.length || 0

      dayStats.correct += correct
      dayStats.total += total
    })

    return Array.from(dailyStats.entries())
      .map(([date, stats]) => ({
        date,
        accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        questionsAnswered: stats.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30) // Last 30 days
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="text-gray-400 mb-4">
          <svg
            className="mx-auto h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Practice Data
        </h3>
        <p className="text-gray-500">
          Start practicing to see your progress and statistics here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-600">
            {stats.totalPracticeSessions}
          </div>
          <div className="text-sm text-gray-600">Practice Sessions</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">
            {stats.totalQuestionsAnswered}
          </div>
          <div className="text-sm text-gray-600">Questions Practiced</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-purple-600">
            {stats.averageAccuracy.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Average Accuracy</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-orange-600">
            {stats.timeSpentHours.toFixed(1)}h
          </div>
          <div className="text-sm text-gray-600">Study Time</div>
        </div>
      </div>

      {/* Accuracy Trend Chart */}
      {stats.accuracyTrend.length > 1 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Accuracy Trend
          </h3>
          <ProgressChart
            data={stats.accuracyTrend.map((d) => ({
              label: d.date,
              value: d.accuracy,
            }))}
            title="Accuracy Trend"
            height={200}
          />
        </div>
      )}

      {showDetailedStats && (
        <>
          {/* Topic Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Strongest Topics */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Strongest Topics
              </h3>
              {stats.strongestTopics.length > 0 ? (
                <div className="space-y-3">
                  {stats.strongestTopics.map((topic, index) => (
                    <div
                      key={topic.topic}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                            index === 0
                              ? 'bg-yellow-500'
                              : index === 1
                                ? 'bg-gray-400'
                                : 'bg-orange-400'
                          }`}
                        >
                          {index + 1}
                        </div>
                        <span className="ml-3 text-sm font-medium text-gray-900">
                          {topic.topic}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-600">
                          {topic.accuracy.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {topic.count} questions
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  Practice more to see your strongest topics.
                </p>
              )}
            </div>

            {/* Areas for Improvement */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Areas for Improvement
              </h3>
              {stats.weakestTopics.length > 0 ? (
                <div className="space-y-3">
                  {stats.weakestTopics.map((topic) => (
                    <div
                      key={topic.topic}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {topic.topic}
                      </span>
                      <div className="text-right">
                        <div className="text-sm font-medium text-red-600">
                          {topic.accuracy.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {topic.count} questions
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  No weak areas identified yet. Keep practicing!
                </p>
              )}
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Recent Practice Sessions
            </h3>
            {stats.recentSessions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Questions
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Score
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Time
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Focus
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.recentSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {new Date(session.completed_at).toLocaleDateString(
                            'en-US',
                            {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {session.question_count}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span
                            className={`font-medium ${
                              session.total_score >= 80
                                ? 'text-green-600'
                                : session.total_score >= 60
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {session.total_score}%
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {Math.floor(session.time_spent / 60)}m{' '}
                          {session.time_spent % 60}s
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {session.module_focus || 'Mixed'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                No recent practice sessions found.
              </p>
            )}
          </div>

          {/* Topic Progress Details */}
          {stats.topicProgress.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Topic Progress Detail
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Topic
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Questions
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Overall
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Recent
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Trend
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.topicProgress
                      .sort((a, b) => b.accuracy - a.accuracy)
                      .map((topic) => (
                        <tr key={topic.topic} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {topic.topic}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {topic.correctAnswers}/{topic.totalQuestions}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span
                              className={`font-medium ${
                                topic.accuracy >= 80
                                  ? 'text-green-600'
                                  : topic.accuracy >= 60
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                              }`}
                            >
                              {topic.accuracy.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span
                              className={`font-medium ${
                                topic.recentAccuracy >= 80
                                  ? 'text-green-600'
                                  : topic.recentAccuracy >= 60
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                              }`}
                            >
                              {topic.recentAccuracy > 0
                                ? `${topic.recentAccuracy.toFixed(1)}%`
                                : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {topic.trend === 'improving' && (
                              <span className="text-green-600">
                                ↗️ Improving
                              </span>
                            )}
                            {topic.trend === 'declining' && (
                              <span className="text-red-600">↘️ Declining</span>
                            )}
                            {topic.trend === 'stable' && (
                              <span className="text-gray-600">→ Stable</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
