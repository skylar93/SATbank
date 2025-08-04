'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../../contexts/auth-context'
import { AnalyticsService, type ComprehensiveResults } from '../../../../lib/analytics-service'
import { ExportService } from '../../../../lib/export-service'
import { ModuleType } from '../../../../lib/exam-service'
import { supabase } from '../../../../lib/supabase'

export default function DetailedResultsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [results, setResults] = useState<ComprehensiveResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'analytics'>('overview')
  const [exporting, setExporting] = useState(false)
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false)

  const attemptId = params.attemptId as string

  useEffect(() => {
    if (user && attemptId) {
      loadResults()
      checkAnswerVisibility()
    }
  }, [user, attemptId])

  const checkAnswerVisibility = async () => {
    if (!user) return
    
    try {
      const { data: profileData, error } = await supabase
        .from('user_profiles')
        .select('show_correct_answers')
        .eq('id', user.id)
        .single()

      if (error) throw error
      
      setShowCorrectAnswers(profileData?.show_correct_answers || false)
    } catch (err: any) {
      console.error('Error checking answer visibility:', err)
      // Default to false if there's an error
      setShowCorrectAnswers(false)
    }
  }

  const loadResults = async () => {
    try {
      const comprehensiveResults = await AnalyticsService.getComprehensiveResults(attemptId)
      setResults(comprehensiveResults)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!results) return
    
    setExporting(true)
    try {
      // Download CSV files
      await ExportService.exportStudentResults(attemptId)
      
      // Also download text report
      ExportService.downloadTextReport(results)
      
    } catch (err: any) {
      setError(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
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

  const getModuleDisplayName = (moduleType: ModuleType) => {
    const names = {
      english1: 'Reading and Writing',
      english2: 'Writing and Language', 
      math1: 'Math (No Calculator)',
      math2: 'Math (Calculator)'
    }
    return names[moduleType]
  }

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 70) return 'text-blue-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'hard': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading detailed results...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !results) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto py-8 px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Results</h3>
            <p className="text-red-700 mb-4">{error || 'Results not found'}</p>
            <Link
              href="/student/results"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Back to Results
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { attempt, detailedScore, questionAnalysis, performanceAnalytics, progressComparison } = results

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Detailed Results
              </h1>
              <p className="text-gray-600">
                Comprehensive analysis of your SAT practice test performance
              </p>
            </div>
            <Link
              href="/student/results"
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors"
            >
              ← Back to Results
            </Link>
          </div>
          
          {/* Separator line with spacing */}
          <div className="border-b border-gray-200 pb-6 mb-8">
            <div className="text-sm text-gray-500">
              Completed: {attempt.completed_at ? formatDate(attempt.completed_at) : 'In Progress'}
            </div>
          </div>
        </div>

        {/* Score Overview Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {detailedScore.totalScore}
              </div>
              <div className="text-sm text-gray-500">Total Score</div>
              <div className="text-xs text-gray-400">400-1600 scale</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {detailedScore.evidenceBasedReading}
              </div>
              <div className="text-sm text-gray-500">Evidence-Based Reading and Writing</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">
                {detailedScore.mathScore}
              </div>
              <div className="text-sm text-gray-500">Math</div>
            </div>
          </div>

          {progressComparison && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {progressComparison.previousAttempts}
                  </div>
                  <div className="text-sm text-gray-500">Previous Attempts</div>
                </div>
                <div>
                  <div className={`text-lg font-semibold ${progressComparison.scoreImprovement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {progressComparison.scoreImprovement >= 0 ? '+' : ''}{progressComparison.scoreImprovement}
                  </div>
                  <div className="text-sm text-gray-500">Score Change</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-blue-600">
                    {Math.round(detailedScore.percentages.overall)}%
                  </div>
                  <div className="text-sm text-gray-500">Overall Accuracy</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'questions', label: 'Question Analysis' },
              { id: 'analytics', label: 'Performance Analytics' }
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
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Module Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Module Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(detailedScore.rawScores).map(([module, score]) => {
                  const moduleType = module as ModuleType
                  const percentage = detailedScore.percentages[moduleType]
                  const percentile = detailedScore.percentiles[moduleType]
                  
                  return (
                    <div key={module} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">
                          {getModuleDisplayName(moduleType)}
                        </h4>
                        <span className={`font-semibold ${getScoreColor(percentage)}`}>
                          {Math.round(percentage)}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Raw Score: {score}</div>
                        <div>Percentile: {percentile}th</div>
                      </div>
                      <div className="mt-2 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-2">Time Management</h4>
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {formatTime(Math.round(performanceAnalytics.averageTimePerQuestion))}
                </div>
                <div className="text-sm text-gray-500">Avg per question</div>
                <div className="text-xs text-gray-400 mt-1">
                  Total: {formatTime(performanceAnalytics.totalTimeSpent)}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-2">Accuracy</h4>
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {Math.round(performanceAnalytics.accuracyRate)}%
                </div>
                <div className="text-sm text-gray-500">
                  {performanceAnalytics.correctAnswers} of {performanceAnalytics.totalQuestions}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-2">Difficulty Performance</h4>
                <div className="space-y-1 text-sm">
                  {Object.entries(performanceAnalytics.difficultyBreakdown).map(([difficulty, stats]) => (
                    <div key={difficulty} className="flex justify-between">
                      <span className="capitalize">{difficulty}:</span>
                      <span className={getScoreColor(stats.percentage)}>
                        {Math.round(stats.percentage)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Question-by-Question Analysis</h3>
              <p className="text-gray-600 mt-1">
                {showCorrectAnswers 
                  ? "Review each question with your answers and explanations" 
                  : "Review each question with your answers (correct answers not available)"}
              </p>
              {!showCorrectAnswers && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="text-yellow-600 mr-2">ℹ️</div>
                    <div className="text-sm text-yellow-800">
                      Correct answers and explanations are not available for review. Contact your administrator for access.
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="divide-y divide-gray-200">
              {questionAnalysis.map((question, index) => (
                <div key={question.questionId} className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                          question.isCorrect ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                          {question.isCorrect ? '✓' : '✗'}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          Question {question.questionNumber} - {getModuleDisplayName(question.moduleType)}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                            {question.difficulty}
                          </span>
                          <span className="text-sm text-gray-500">
                            Time: {formatTime(question.timeSpent)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`grid ${showCorrectAnswers ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4 text-sm`}>
                    <div>
                      <div className="text-gray-600">Your Answer:</div>
                      <div className={`font-medium ${question.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                        {question.userAnswer || 'No answer'}
                      </div>
                    </div>
                    {showCorrectAnswers && (
                      <div>
                        <div className="text-gray-600">Correct Answer{Array.isArray(question.correctAnswer) && question.correctAnswer.length > 1 ? 's' : ''}:</div>
                        <div className="font-medium text-green-600">
                          {Array.isArray(question.correctAnswer) 
                            ? question.correctAnswer.join(', ')
                            : question.correctAnswer
                          }
                        </div>
                      </div>
                    )}
                  </div>

                  {question.topicTags && question.topicTags.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm text-gray-600 mb-1">Topics:</div>
                      <div className="flex flex-wrap gap-1">
                        {question.topicTags.map((tag, tagIndex) => (
                          <span key={tagIndex} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {showCorrectAnswers && question.explanation && (
                    <div className="mt-3 p-3 bg-gray-50 rounded">
                      <div className="text-sm text-gray-600 mb-1">Explanation:</div>
                      <div className="text-sm text-gray-800">{question.explanation}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Strengths and Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Strength Areas
                </h4>
                {performanceAnalytics.strengthAreas.length > 0 ? (
                  <div className="space-y-2">
                    {performanceAnalytics.strengthAreas.map((area, index) => (
                      <div key={index} className="bg-green-50 text-green-800 px-3 py-2 rounded text-sm">
                        {area}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No strength areas identified (80%+ accuracy needed)</p>
                )}
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                  Areas for Improvement
                </h4>
                {performanceAnalytics.weaknessAreas.length > 0 ? (
                  <div className="space-y-2">
                    {performanceAnalytics.weaknessAreas.map((area, index) => (
                      <div key={index} className="bg-red-50 text-red-800 px-3 py-2 rounded text-sm">
                        {area}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Great job! No major weak areas identified</p>
                )}
              </div>
            </div>

            {/* Topic Performance */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h4 className="font-medium text-gray-900 mb-4">Topic Performance Breakdown</h4>
              <div className="space-y-3">
                {performanceAnalytics.topicPerformance.map((topic, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-900">{topic.topic}</span>
                        <span className={`text-sm font-medium ${getScoreColor(topic.percentage)}`}>
                          {Math.round(topic.percentage)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                        <span>{topic.correct} of {topic.attempted} correct</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            topic.percentage >= 80 ? 'bg-green-500' :
                            topic.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${topic.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex justify-center space-x-4">
          <Link
            href="/student/exams"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Take Another Exam
          </Link>
          <button 
            onClick={handleExport}
            disabled={exporting}
            className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {exporting ? 'Exporting...' : 'Export Results'}
          </button>
        </div>
      </div>
    </div>
  )
}