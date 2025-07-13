'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../contexts/auth-context'

interface Question {
  id: string
  module_type: string
  question_number: number
  question_type: string
  difficulty_level: string
  question_text: string
  options: any
  correct_answer: string
  explanation: string
  topic_tags: string[]
  is_incorrect?: boolean
}

interface PracticeQuizGeneratorProps {
  questions: Question[]
  availableTopics: string[]
}

interface PracticeSettings {
  module: string
  difficulty: string
  questionType: string
  topics: string[]
  questionCount: number
  shuffleQuestions: boolean
  showExplanations: boolean
  timeLimit: number
  includeIncorrectOnly: boolean
}

export function PracticeQuizGenerator({ questions, availableTopics }: PracticeQuizGeneratorProps) {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  const [settings, setSettings] = useState<PracticeSettings>({
    module: 'all',
    difficulty: 'all',
    questionType: 'all',
    topics: [],
    questionCount: 10,
    shuffleQuestions: true,
    showExplanations: true,
    timeLimit: 0, // 0 means no time limit
    includeIncorrectOnly: false
  })
  const [isGenerating, setIsGenerating] = useState(false)

  const filteredQuestions = questions.filter(question => {
    if (settings.module !== 'all' && question.module_type !== settings.module) return false
    if (settings.difficulty !== 'all' && question.difficulty_level !== settings.difficulty) return false
    if (settings.questionType !== 'all' && question.question_type !== settings.questionType) return false
    if (settings.topics.length > 0 && !settings.topics.some(topic => question.topic_tags?.includes(topic))) return false
    if (settings.includeIncorrectOnly && !question.is_incorrect) return false
    return true
  })

  const maxAvailableQuestions = filteredQuestions.length
  const canGenerate = maxAvailableQuestions > 0 && settings.questionCount <= maxAvailableQuestions

  const handleSettingChange = (key: keyof PracticeSettings, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value }
      
      // Adjust question count if it exceeds available questions
      if (key !== 'questionCount') {
        const filteredCount = questions.filter(question => {
          if (newSettings.module !== 'all' && question.module_type !== newSettings.module) return false
          if (newSettings.difficulty !== 'all' && question.difficulty_level !== newSettings.difficulty) return false
          if (newSettings.questionType !== 'all' && question.question_type !== newSettings.questionType) return false
          if (newSettings.topics.length > 0 && !newSettings.topics.some(topic => question.topic_tags?.includes(topic))) return false
          if (newSettings.includeIncorrectOnly && !question.is_incorrect) return false
          return true
        }).length
        
        if (newSettings.questionCount > filteredCount) {
          newSettings.questionCount = Math.max(1, filteredCount)
        }
      }
      
      return newSettings
    })
  }

  const handleTopicToggle = (topic: string) => {
    const newTopics = settings.topics.includes(topic)
      ? settings.topics.filter(t => t !== topic)
      : [...settings.topics, topic]
    handleSettingChange('topics', newTopics)
  }

  const generatePracticeQuiz = async () => {
    console.log('🎯 Generate Practice Quiz called')
    console.log('canGenerate:', canGenerate)
    console.log('user:', user?.id)
    console.log('supabase:', !!supabase)
    console.log('filteredQuestions.length:', filteredQuestions.length)
    console.log('settings:', settings)

    if (!canGenerate) {
      console.log('❌ Cannot generate: canGenerate is false')
      alert(`Cannot generate quiz: ${maxAvailableQuestions} questions available, ${settings.questionCount} requested`)
      return
    }

    if (!user) {
      console.log('❌ Cannot generate: no user')
      alert('Please log in to generate practice quiz')
      return
    }

    if (!supabase) {
      console.log('❌ Cannot generate: no supabase client')
      alert('Database connection not available')
      return
    }

    setIsGenerating(true)
    try {
      // Filter and select questions
      let selectedQuestions = [...filteredQuestions]
      
      if (settings.shuffleQuestions) {
        // Shuffle questions
        for (let i = selectedQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[selectedQuestions[i], selectedQuestions[j]] = [selectedQuestions[j], selectedQuestions[i]]
        }
      }
      
      // Take the requested number of questions
      selectedQuestions = selectedQuestions.slice(0, settings.questionCount)

      if (selectedQuestions.length === 0) {
        throw new Error('No questions available for the selected criteria')
      }

      // Use the auth context user ID (now synchronized with Supabase session)
      let attempt
      
      const { data, error } = await supabase
        .from('test_attempts')
        .insert({
          user_id: user.id,
          exam_id: null, // Practice mode doesn't use exam_id
          status: 'not_started',
          is_practice_mode: true,
          current_module: selectedQuestions[0].module_type,
          current_question_number: 1,
          expires_at: settings.timeLimit > 0 
            ? new Date(Date.now() + settings.timeLimit * 60 * 1000).toISOString()
            : null
        })
        .select()
        .single()
        
      if (error) {
        console.log('Direct insert failed, trying emergency function:', error)
        
        const { data: emergencyResult, error: emergencyError } = await supabase
          .rpc('create_practice_session', {
            target_user_id: user.id,
            module_name: selectedQuestions[0].module_type,
            is_single_question: false
          })

        if (emergencyError || !emergencyResult?.[0]?.success) {
          throw new Error(emergencyError?.message || emergencyResult?.[0]?.error_message || 'Failed to create practice session')
        }

        // Get the created attempt
        const { data: createdAttempt, error: fetchError } = await supabase
          .from('test_attempts')
          .select()
          .eq('id', emergencyResult[0].attempt_id)
          .single()

        if (fetchError) throw fetchError
        attempt = createdAttempt
      } else {
        attempt = data
      }

      // Store practice settings and questions in localStorage for the session
      const practiceData = {
        attemptId: attempt.id,
        questions: selectedQuestions.map(q => q.id),
        settings: {
          shuffleQuestions: settings.shuffleQuestions,
          showExplanations: settings.showExplanations,
          timeLimit: settings.timeLimit
        }
      }
      
      localStorage.setItem(`practice_${attempt.id}`, JSON.stringify(practiceData))

      // Navigate to practice session
      router.push(`/student/practice/${attempt.id}`)
      
    } catch (error: any) {
      console.error('Error generating practice quiz:', error)
      
      // Show more specific error messages
      let errorMessage = 'Failed to generate practice quiz. Please try again.'
      if (error.message) {
        errorMessage = error.message
      } else if (error.details) {
        errorMessage = `Database error: ${error.details}`
      } else if (error.hint) {
        errorMessage = `Error: ${error.hint}`
      }
      
      alert(errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Settings Panel */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Practice Quiz Settings</h3>
        
        <div className="space-y-6">
          {/* Quick Options */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Quick Options</h4>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.includeIncorrectOnly}
                  onChange={(e) => handleSettingChange('includeIncorrectOnly', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Include only previously incorrect answers ({questions.filter(q => q.is_incorrect).length} questions)
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.shuffleQuestions}
                  onChange={(e) => handleSettingChange('shuffleQuestions', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Shuffle question order</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.showExplanations}
                  onChange={(e) => handleSettingChange('showExplanations', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Show explanations after each question</span>
              </label>
            </div>
          </div>

          {/* Module Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Module</label>
            <select
              value={settings.module}
              onChange={(e) => handleSettingChange('module', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Modules</option>
              <option value="english1">English 1</option>
              <option value="english2">English 2</option>
              <option value="math1">Math 1</option>
              <option value="math2">Math 2</option>
            </select>
          </div>

          {/* Difficulty Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
            <select
              value={settings.difficulty}
              onChange={(e) => handleSettingChange('difficulty', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Levels</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Question Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
            <select
              value={settings.questionType}
              onChange={(e) => handleSettingChange('questionType', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="grid_in">Grid-in</option>
              <option value="essay">Essay</option>
            </select>
          </div>

          {/* Topics Selection */}
          {availableTopics.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topics {settings.topics.length > 0 && `(${settings.topics.length} selected)`}
              </label>
              <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                <div className="space-y-1">
                  {availableTopics.map(topic => (
                    <label key={topic} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.topics.includes(topic)}
                        onChange={() => handleTopicToggle(topic)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{topic}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Question Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Questions (max: {maxAvailableQuestions})
            </label>
            <input
              type="number"
              min="1"
              max={maxAvailableQuestions}
              value={settings.questionCount}
              onChange={(e) => handleSettingChange('questionCount', parseInt(e.target.value) || 1)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Time Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Limit (minutes, 0 = no limit)
            </label>
            <input
              type="number"
              min="0"
              value={settings.timeLimit}
              onChange={(e) => handleSettingChange('timeLimit', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Preview and Generate */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Quiz Preview</h3>
        
        <div className="space-y-4">
          {/* Quiz Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Quiz Summary</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-medium">Questions:</span> {settings.questionCount} of {maxAvailableQuestions} available</p>
              <p><span className="font-medium">Module:</span> {settings.module === 'all' ? 'All Modules' : settings.module}</p>
              <p><span className="font-medium">Difficulty:</span> {settings.difficulty === 'all' ? 'All Levels' : settings.difficulty}</p>
              <p><span className="font-medium">Type:</span> {settings.questionType === 'all' ? 'All Types' : settings.questionType}</p>
              {settings.topics.length > 0 && (
                <p><span className="font-medium">Topics:</span> {settings.topics.join(', ')}</p>
              )}
              <p><span className="font-medium">Order:</span> {settings.shuffleQuestions ? 'Shuffled' : 'Original'}</p>
              <p><span className="font-medium">Explanations:</span> {settings.showExplanations ? 'Shown' : 'Hidden'}</p>
              <p><span className="font-medium">Time Limit:</span> {settings.timeLimit === 0 ? 'No limit' : `${settings.timeLimit} minutes`}</p>
            </div>
          </div>

          {/* Error Messages */}
          {!canGenerate && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">
                {maxAvailableQuestions === 0 
                  ? 'No questions match your current filters. Please adjust your settings.'
                  : `Only ${maxAvailableQuestions} questions available. Please reduce the question count.`
                }
              </p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={generatePracticeQuiz}
            disabled={!canGenerate || isGenerating}
            className={`w-full px-6 py-3 rounded-md font-medium transition-colors ${
              canGenerate && !isGenerating
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isGenerating ? 'Generating Quiz...' : 'Start Practice Quiz'}
          </button>

          {/* Quick Start Options */}
          <div className="pt-4 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Quick Start</h4>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setSettings({
                    module: 'all',
                    difficulty: 'all',
                    questionType: 'multiple_choice',
                    topics: [],
                    questionCount: 10,
                    shuffleQuestions: true,
                    showExplanations: true,
                    timeLimit: 0,
                    includeIncorrectOnly: false
                  })
                }}
                className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border"
              >
                📚 Mixed Practice (10 questions, all modules)
              </button>
              <button
                onClick={() => {
                  setSettings({
                    module: 'all',
                    difficulty: 'all',
                    questionType: 'all',
                    topics: [],
                    questionCount: Math.min(5, questions.filter(q => q.is_incorrect).length),
                    shuffleQuestions: true,
                    showExplanations: true,
                    timeLimit: 0,
                    includeIncorrectOnly: true
                  })
                }}
                className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border"
              >
                🎯 Review Mistakes (incorrect answers only)
              </button>
              <button
                onClick={() => {
                  setSettings({
                    module: 'all',
                    difficulty: 'all',
                    questionType: 'all',
                    topics: [],
                    questionCount: 20,
                    shuffleQuestions: true,
                    showExplanations: false,
                    timeLimit: 25,
                    includeIncorrectOnly: false
                  })
                }}
                className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border"
              >
                ⏱️ Timed Sprint (20 questions, 25 minutes)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}