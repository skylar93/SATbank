'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import {
  RecommendationService,
  type StudyRecommendation,
  type WeaknessAnalysis,
} from '../../../lib/recommendation-service'
import { CircularProgress } from '../../../components/charts'
import { StatsCard } from '../../../components/modern-charts'
import {
  BookOpenIcon,
  ClockIcon,
  ChartBarIcon,
  AcademicCapIcon,
  FireIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BoltIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'

export default function RecommendationsPage() {
  const { user } = useAuth()
  const [recommendations, setRecommendations] = useState<StudyRecommendation[]>(
    []
  )
  const [weaknessAnalysis, setWeaknessAnalysis] =
    useState<WeaknessAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<
    'recommendations' | 'weaknesses' | 'practice'
  >('recommendations')

  useEffect(() => {
    if (user) {
      loadRecommendations()
    }
  }, [user])

  const loadRecommendations = async () => {
    try {
      const [recs, analysis] = await Promise.all([
        RecommendationService.generateRecommendations(user!.id),
        RecommendationService.analyzeWeaknesses(user!.id),
      ])

      setRecommendations(recs)
      setWeaknessAnalysis(analysis)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-orange-100 text-orange-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'topic':
        return <BookOpenIcon className="w-5 h-5" />
      case 'difficulty':
        return <BoltIcon className="w-5 h-5" />
      case 'module':
        return <AcademicCapIcon className="w-5 h-5" />
      case 'time_management':
        return <ClockIcon className="w-5 h-5" />
      default:
        return <ChartBarIcon className="w-5 h-5" />
    }
  }

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  if (!user) return null

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Study Plan</h1>
            <p className="text-gray-600">
              Personalized recommendations based on your performance
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search recommendations..."
                className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user.profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              {
                id: 'recommendations',
                label: 'Study Plan',
                icon: BookOpenIcon,
              },
              {
                id: 'weaknesses',
                label: 'Weakness Analysis',
                icon: ChartBarIcon,
              },
              {
                id: 'practice',
                label: 'Practice Sessions',
                icon: AcademicCapIcon,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-violet-500 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-800">
                Error loading recommendations: {error}
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <ChartBarIcon className="w-8 h-8 text-white" />
            </div>
            <p className="text-gray-600">Analyzing your performance...</p>
          </div>
        ) : (
          <>
            {/* Tab Content */}
            {activeTab === 'recommendations' && (
              <div className="space-y-6">
                {recommendations.length === 0 ? (
                  <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-8 text-center border border-violet-100">
                    <div className="w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AcademicCapIcon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Take Your First Test
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Complete at least one practice test to receive
                      personalized study recommendations.
                    </p>
                    <Link
                      href="/student/exams"
                      className="inline-flex items-center bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg"
                    >
                      <AcademicCapIcon className="w-5 h-5 mr-2" />
                      Take a Practice Test
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Study Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      <StatsCard
                        title="Total Study Time"
                        value={formatTime(
                          recommendations.reduce(
                            (sum, r) => sum + r.estimatedStudyTime,
                            0
                          )
                        )}
                        change="+2.5%"
                        changeType="positive"
                      />

                      <StatsCard
                        title="High Priority Areas"
                        value={
                          recommendations.filter((r) => r.priority === 'high')
                            .length
                        }
                        change="+0.8%"
                        changeType="positive"
                      />

                      <StatsCard
                        title="Total Recommendations"
                        value={recommendations.length}
                        change="+12%"
                        changeType="positive"
                      />
                    </div>

                    {/* Recommendations Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {recommendations.map((recommendation, index) => (
                        <div
                          key={index}
                          className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center">
                                <div className="text-violet-600">
                                  {getTypeIcon(recommendation.type)}
                                </div>
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {recommendation.title}
                                </h3>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(recommendation.priority)}`}
                                  >
                                    {recommendation.priority.toUpperCase()}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {formatTime(
                                      recommendation.estimatedStudyTime
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                            {recommendation.description}
                          </p>

                          <div className="mb-4">
                            <h4 className="font-medium text-gray-900 mb-2 text-sm">
                              Action Plan:
                            </h4>
                            <ul className="space-y-2">
                              {recommendation.actionItems.map(
                                (item, itemIndex) => (
                                  <li
                                    key={itemIndex}
                                    className="flex items-start text-sm"
                                  >
                                    <CheckCircleIcon className="w-4 h-4 text-violet-500 mr-2 mt-0.5 flex-shrink-0" />
                                    <span className="text-gray-700">
                                      {item}
                                    </span>
                                  </li>
                                )
                              )}
                            </ul>
                          </div>

                          <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                            <div className="text-xs text-gray-500">
                              Focus:{' '}
                              {recommendation.type
                                .replace('_', ' ')
                                .toLowerCase()}
                            </div>
                            <button className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 shadow-lg">
                              Start Studying
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'weaknesses' && weaknessAnalysis && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Topic Weaknesses */}
                  <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Topic Weaknesses
                    </h3>
                    {weaknessAnalysis.weakTopics.length === 0 ? (
                      <div className="text-center py-8">
                        <TrophyIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
                        <p className="text-gray-600">
                          No significant weaknesses identified!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {weaknessAnalysis.weakTopics
                          .slice(0, 5)
                          .map((topic, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                            >
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 text-sm">
                                  {topic.topic}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {topic.questionsCorrect} /{' '}
                                  {topic.questionsAttempted} correct
                                </div>
                              </div>
                              <div className="text-right ml-4">
                                <div
                                  className={`text-lg font-bold ${
                                    topic.accuracyRate >= 70
                                      ? 'text-orange-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {Math.round(topic.accuracyRate)}%
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Performance Summary */}
                  <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Performance Summary
                    </h3>
                    <div className="flex justify-center mb-6">
                      <CircularProgress
                        percentage={75}
                        size={120}
                        color="rgb(139, 92, 246)"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-violet-500"></div>
                          <span className="text-sm text-gray-700">Math</span>
                        </div>
                        <span className="text-sm font-semibold">720/800</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                          <span className="text-sm text-gray-700">
                            Reading & Writing
                          </span>
                        </div>
                        <span className="text-sm font-semibold">680/800</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span className="text-sm text-gray-700">Overall</span>
                        </div>
                        <span className="text-sm font-semibold">1400/1600</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Difficulty Analysis */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Performance by Difficulty
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(weaknessAnalysis.difficultyStruggles).map(
                      ([difficulty, stats]) => (
                        <div
                          key={difficulty}
                          className="p-4 bg-gray-50 rounded-xl"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900 capitalize">
                              {difficulty}
                            </h4>
                            <span
                              className={`text-lg font-bold ${
                                stats.rate >= 80
                                  ? 'text-green-600'
                                  : stats.rate >= 60
                                    ? 'text-orange-600'
                                    : 'text-red-600'
                              }`}
                            >
                              {Math.round(stats.rate)}%
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 mb-3">
                            {stats.correct} / {stats.attempted} correct
                          </div>
                          <div className="bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                stats.rate >= 80
                                  ? 'bg-green-500'
                                  : stats.rate >= 60
                                    ? 'bg-orange-500'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${stats.rate}%` }}
                            ></div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'practice' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Targeted Practice Sessions
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Based on your weaknesses, here are focused practice sessions
                    to help you improve.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {weaknessAnalysis?.weakTopics
                      .slice(0, 3)
                      .map((topic, index) => (
                        <div
                          key={index}
                          className="p-4 border border-gray-200 rounded-xl hover:border-violet-300 transition-colors"
                        >
                          <div className="flex items-center space-x-3 mb-3">
                            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                              <BookOpenIcon className="w-5 h-5 text-violet-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {topic.topic}
                              </h4>
                              <p className="text-xs text-gray-500">
                                Practice Session
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-4">
                            Current: {Math.round(topic.accuracyRate)}% • Target:
                            80%+
                          </p>
                          <button className="w-full bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            Start Practice
                          </button>
                        </div>
                      ))}

                    <div className="p-4 border border-gray-200 rounded-xl hover:border-red-300 transition-colors">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                          <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            Wrong Answers
                          </h4>
                          <p className="text-xs text-gray-500">
                            Review Session
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Review your recent mistakes and learn from them.
                      </p>
                      <button className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Review Mistakes
                      </button>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-xl hover:border-green-300 transition-colors">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <ClockIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">
                            Timed Practice
                          </h4>
                          <p className="text-xs text-gray-500">
                            Speed Training
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Improve your speed and time management skills.
                      </p>
                      <button className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        Start Timer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center space-x-4">
          <Link
            href="/student/exams"
            className="flex items-center bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg"
          >
            <AcademicCapIcon className="w-5 h-5 mr-2" />
            Take Practice Test
          </Link>
          <Link
            href="/student/results"
            className="flex items-center bg-white hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-xl font-semibold transition-colors border border-gray-200"
          >
            <ChartBarIcon className="w-5 h-5 mr-2" />
            View Results
          </Link>
        </div>
      </div>
    </div>
  )
}
