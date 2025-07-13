'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../contexts/auth-context'
import { Navigation } from '../../../components/navigation'
import { RecommendationService, type StudyRecommendation, type WeaknessAnalysis } from '../../../lib/recommendation-service'

export default function RecommendationsPage() {
  const { user } = useAuth()
  const [recommendations, setRecommendations] = useState<StudyRecommendation[]>([])
  const [weaknessAnalysis, setWeaknessAnalysis] = useState<WeaknessAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'recommendations' | 'weaknesses' | 'practice'>('recommendations')

  useEffect(() => {
    if (user) {
      loadRecommendations()
    }
  }, [user])

  const loadRecommendations = async () => {
    try {
      const [recs, analysis] = await Promise.all([
        RecommendationService.generateRecommendations(user!.id),
        RecommendationService.analyzeWeaknesses(user!.id)
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
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'topic': return '📚'
      case 'difficulty': return '⚡'
      case 'module': return '📝'
      case 'time_management': return '⏰'
      default: return '💡'
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
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Study Recommendations
          </h1>
          <p className="text-gray-600">
            Personalized study plan based on your performance analysis
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error loading recommendations: {error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Analyzing your performance...</p>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {[
                  { id: 'recommendations', label: 'Study Plan' },
                  { id: 'weaknesses', label: 'Weakness Analysis' },
                  { id: 'practice', label: 'Practice Sessions' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'recommendations' && (
              <div className="space-y-6">
                {recommendations.length === 0 ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
                    <h3 className="text-lg font-medium text-blue-900 mb-2">Take a Test First</h3>
                    <p className="text-blue-700 mb-4">
                      Complete at least one practice test to receive personalized study recommendations.
                    </p>
                    <Link
                      href="/student/exams"
                      className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Take a Practice Test
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Study Time Summary */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended Study Time</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {formatTime(recommendations.reduce((sum, r) => sum + r.estimatedStudyTime, 0))}
                          </div>
                          <div className="text-sm text-gray-600">Total Study Time</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {recommendations.filter(r => r.priority === 'high').length}
                          </div>
                          <div className="text-sm text-gray-600">High Priority Areas</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {recommendations.length}
                          </div>
                          <div className="text-sm text-gray-600">Total Recommendations</div>
                        </div>
                      </div>
                    </div>

                    {/* Recommendations List */}
                    <div className="space-y-4">
                      {recommendations.map((recommendation, index) => (
                        <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <span className="text-2xl">{getTypeIcon(recommendation.type)}</span>
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {recommendation.title}
                                </h3>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(recommendation.priority)}`}>
                                    {recommendation.priority.toUpperCase()} PRIORITY
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    Est. {formatTime(recommendation.estimatedStudyTime)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <p className="text-gray-700 mb-4">{recommendation.description}</p>

                          <div className="mb-4">
                            <h4 className="font-medium text-gray-900 mb-2">Action Plan:</h4>
                            <ul className="space-y-1">
                              {recommendation.actionItems.map((item, itemIndex) => (
                                <li key={itemIndex} className="flex items-start">
                                  <span className="text-blue-500 mr-2">•</span>
                                  <span className="text-gray-700 text-sm">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                            <div className="text-sm text-gray-500">
                              Focus Area: {recommendation.type.replace('_', ' ').toUpperCase()}
                            </div>
                            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
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
                {/* Topic Weaknesses */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Topic Weaknesses</h3>
                  {weaknessAnalysis.weakTopics.length === 0 ? (
                    <p className="text-gray-500">No significant topic weaknesses identified. Great work!</p>
                  ) : (
                    <div className="space-y-3">
                      {weaknessAnalysis.weakTopics.slice(0, 6).map((topic, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{topic.topic}</div>
                            <div className="text-sm text-gray-600">
                              {topic.questionsCorrect} / {topic.questionsAttempted} correct
                              {topic.recentMistakes > 0 && (
                                <span className="text-red-600 ml-2">
                                  ({topic.recentMistakes} recent mistakes)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className={`text-lg font-bold ${
                              topic.accuracyRate >= 70 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {Math.round(topic.accuracyRate)}%
                            </div>
                            <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className={`h-2 rounded-full ${
                                  topic.accuracyRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${topic.accuracyRate}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Difficulty Analysis */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Difficulty</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(weaknessAnalysis.difficultyStruggles).map(([difficulty, stats]) => (
                      <div key={difficulty} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900 capitalize">{difficulty}</h4>
                          <span className={`text-lg font-bold ${
                            stats.rate >= 80 ? 'text-green-600' :
                            stats.rate >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {Math.round(stats.rate)}%
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {stats.correct} / {stats.attempted} correct
                        </div>
                        <div className="bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              stats.rate >= 80 ? 'bg-green-500' :
                              stats.rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${stats.rate}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Module Weaknesses */}
                {weaknessAnalysis.moduleWeaknesses.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Module Weaknesses</h3>
                    <div className="space-y-4">
                      {weaknessAnalysis.moduleWeaknesses.map((module, index) => {
                        const moduleNames = {
                          english1: 'Reading and Writing',
                          english2: 'Writing and Language',
                          math1: 'Math (No Calculator)',
                          math2: 'Math (Calculator)'
                        }
                        
                        return (
                          <div key={index} className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-gray-900">
                                {moduleNames[module.module]}
                              </h4>
                              <span className={`text-lg font-bold ${
                                module.accuracyRate >= 75 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {Math.round(module.accuracyRate)}%
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              Avg time per question: {Math.round(module.avgTimePerQuestion)}s
                            </div>
                            {module.commonMistakes.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {module.commonMistakes.map((mistake, mistakeIndex) => (
                                  <span key={mistakeIndex} className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                                    {mistake}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Time Management */}
                {(weaknessAnalysis.timeManagementIssues.tooSlow || weaknessAnalysis.timeManagementIssues.tooFast) && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Time Management</h3>
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center mb-2">
                        <span className="text-xl mr-2">⏰</span>
                        <h4 className="font-medium text-orange-900">
                          {weaknessAnalysis.timeManagementIssues.tooSlow ? 'Working Too Slowly' : 'Working Too Quickly'}
                        </h4>
                      </div>
                      <p className="text-orange-800 text-sm mb-3">
                        Your average time per question is {Math.round(weaknessAnalysis.timeManagementIssues.avgTimePerQuestion)}s. 
                        The recommended time is around {weaknessAnalysis.timeManagementIssues.recommendedTime}s per question.
                      </p>
                      <div className="text-sm text-orange-700">
                        {weaknessAnalysis.timeManagementIssues.tooSlow 
                          ? 'Focus on time management strategies and quick elimination techniques.'
                          : 'Take more time to read questions carefully and double-check your work.'
                        }
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'practice' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Targeted Practice Sessions</h3>
                  <p className="text-gray-600 mb-6">
                    Based on your weaknesses, here are some focused practice sessions to help you improve.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {weaknessAnalysis?.weakTopics.slice(0, 4).map((topic, index) => (
                      <div key={index} className="p-4 border border-gray-200 rounded-lg">
                        <h4 className="font-medium text-gray-900 mb-2">{topic.topic} Practice</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Current accuracy: {Math.round(topic.accuracyRate)}% • 
                          Target: 80%+
                        </p>
                        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                          Practice {topic.topic} Questions
                        </button>
                      </div>
                    ))}
                    
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Wrong Answer Review</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Review your recent mistakes and understand the correct solutions.
                      </p>
                      <button className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                        Review Wrong Answers
                      </button>
                    </div>
                    
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Timed Practice</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Improve your speed and time management with timed questions.
                      </p>
                      <button className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                        Start Timed Practice
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Navigation Actions */}
        <div className="mt-8 flex justify-center space-x-4">
          <Link
            href="/student/exams"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Take Practice Test
          </Link>
          <Link
            href="/student/results"
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            View Past Results
          </Link>
        </div>
      </div>
    </div>
  )
}