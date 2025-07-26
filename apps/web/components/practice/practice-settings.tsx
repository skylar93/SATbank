'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/auth-context'

interface PracticePreferences {
  defaultQuestionCount: number
  defaultTimeLimit: number
  showExplanations: boolean
  shuffleQuestions: boolean
  autoAdvance: boolean
  preferredDifficulty: string
  preferredModule: string
  enableSounds: boolean
  darkMode: boolean
  pauseOnIncorrect: boolean
  showProgressBar: boolean
  saveProgress: boolean
}

interface SettingOption {
  value: string
  label: string
}

interface SettingConfig {
  key: keyof PracticePreferences
  label: string
  type: 'number' | 'select' | 'checkbox'
  description: string
  options?: SettingOption[]
  min?: number
  max?: number
}

interface SettingsGroup {
  title: string
  settings: SettingConfig[]
}

interface PracticeSettingsProps {
  onSettingsChange?: (settings: PracticePreferences) => void
  embedded?: boolean
}

export function PracticeSettings({ onSettingsChange, embedded = false }: PracticeSettingsProps) {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<PracticePreferences>({
    defaultQuestionCount: 10,
    defaultTimeLimit: 0,
    showExplanations: true,
    shuffleQuestions: true,
    autoAdvance: false,
    preferredDifficulty: 'all',
    preferredModule: 'all',
    enableSounds: false,
    darkMode: false,
    pauseOnIncorrect: false,
    showProgressBar: true,
    saveProgress: true
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadPreferences()
  }, [user])

  const loadPreferences = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`practice_preferences_${user?.id}`)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setPreferences(prev => ({ ...prev, ...parsed }))
        } catch (error) {
          console.error('Error loading practice preferences:', error)
        }
      }
    }
  }

  const savePreferences = async () => {
    if (!user) return

    setSaving(true)
    try {
      // Save to localStorage
      localStorage.setItem(`practice_preferences_${user.id}`, JSON.stringify(preferences))
      
      // Call parent callback if provided
      if (onSettingsChange) {
        onSettingsChange(preferences)
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' })
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Error saving preferences:', error)
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' })
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handlePreferenceChange = (key: keyof PracticePreferences, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const resetToDefaults = () => {
    setPreferences({
      defaultQuestionCount: 10,
      defaultTimeLimit: 0,
      showExplanations: true,
      shuffleQuestions: true,
      autoAdvance: false,
      preferredDifficulty: 'all',
      preferredModule: 'all',
      enableSounds: false,
      darkMode: false,
      pauseOnIncorrect: false,
      showProgressBar: true,
      saveProgress: true
    })
  }

  const settingsGroups: SettingsGroup[] = [
    {
      title: 'Default Quiz Settings',
      settings: [
        {
          key: 'defaultQuestionCount' as keyof PracticePreferences,
          label: 'Default Number of Questions',
          type: 'number',
          min: 1,
          max: 50,
          description: 'Default question count when creating practice quizzes'
        },
        {
          key: 'defaultTimeLimit' as keyof PracticePreferences,
          label: 'Default Time Limit (minutes)',
          type: 'number',
          min: 0,
          max: 180,
          description: '0 means no time limit'
        },
        {
          key: 'preferredDifficulty' as keyof PracticePreferences,
          label: 'Preferred Difficulty',
          type: 'select',
          options: [
            { value: 'all', label: 'All Levels' },
            { value: 'easy', label: 'Easy' },
            { value: 'medium', label: 'Medium' },
            { value: 'hard', label: 'Hard' }
          ],
          description: 'Default difficulty filter for practice sessions'
        },
        {
          key: 'preferredModule' as keyof PracticePreferences,
          label: 'Preferred Module',
          type: 'select',
          options: [
            { value: 'all', label: 'All Modules' },
            { value: 'english1', label: 'English 1' },
            { value: 'english2', label: 'English 2' },
            { value: 'math1', label: 'Math 1' },
            { value: 'math2', label: 'Math 2' }
          ],
          description: 'Default module filter for practice sessions'
        }
      ]
    },
    {
      title: 'Practice Experience',
      settings: [
        {
          key: 'showExplanations' as keyof PracticePreferences,
          label: 'Show Explanations',
          type: 'checkbox',
          description: 'Display explanations after answering questions'
        },
        {
          key: 'shuffleQuestions' as keyof PracticePreferences,
          label: 'Shuffle Questions',
          type: 'checkbox',
          description: 'Randomize question order in practice sessions'
        },
        {
          key: 'autoAdvance' as keyof PracticePreferences,
          label: 'Auto-Advance Questions',
          type: 'checkbox',
          description: 'Automatically move to next question after answering'
        },
        {
          key: 'pauseOnIncorrect' as keyof PracticePreferences,
          label: 'Pause on Incorrect Answers',
          type: 'checkbox',
          description: 'Require manual confirmation before proceeding after wrong answers'
        }
      ]
    },
    {
      title: 'Interface & Accessibility',
      settings: [
        {
          key: 'showProgressBar' as keyof PracticePreferences,
          label: 'Show Progress Bar',
          type: 'checkbox',
          description: 'Display progress indicator during practice sessions'
        },
        {
          key: 'enableSounds' as keyof PracticePreferences,
          label: 'Enable Sound Effects',
          type: 'checkbox',
          description: 'Play sound feedback for correct/incorrect answers'
        },
        {
          key: 'darkMode' as keyof PracticePreferences,
          label: 'Dark Mode',
          type: 'checkbox',
          description: 'Use dark theme for practice sessions'
        },
        {
          key: 'saveProgress' as keyof PracticePreferences,
          label: 'Save Progress',
          type: 'checkbox',
          description: 'Automatically save practice session progress'
        }
      ]
    }
  ]

  if (embedded) {
    // Return a simplified version for embedding in other components
    return (
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Quick Settings</h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Questions
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={preferences.defaultQuestionCount}
              onChange={(e) => handlePreferenceChange('defaultQuestionCount', parseInt(e.target.value) || 1)}
              className="w-full border border-gray-300 rounded-md px-3 py-1 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Limit (min)
            </label>
            <input
              type="number"
              min="0"
              max="180"
              value={preferences.defaultTimeLimit}
              onChange={(e) => handlePreferenceChange('defaultTimeLimit', parseInt(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-md px-3 py-1 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={preferences.showExplanations}
              onChange={(e) => handlePreferenceChange('showExplanations', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Show explanations</span>
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={preferences.shuffleQuestions}
              onChange={(e) => handlePreferenceChange('shuffleQuestions', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Shuffle questions</span>
          </label>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium text-gray-900">Practice Settings</h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={resetToDefaults}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Reset to Defaults
              </button>
              <button
                onClick={savePreferences}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
          
          {message && (
            <div className={`mt-3 p-3 rounded-md ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        <div className="p-6 space-y-8">
          {settingsGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h3 className="text-lg font-medium text-gray-900 mb-4">{group.title}</h3>
              
              <div className="space-y-4">
                {group.settings.map((setting) => (
                  <div key={setting.key} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1 pr-4">
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        {setting.label}
                      </label>
                      {setting.description && (
                        <p className="text-sm text-gray-500">{setting.description}</p>
                      )}
                    </div>
                    
                    <div className="flex-shrink-0">
                      {setting.type === 'checkbox' ? (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preferences[setting.key] as boolean}
                            onChange={(e) => handlePreferenceChange(setting.key, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      ) : setting.type === 'select' ? (
                        <select
                          value={preferences[setting.key] as string}
                          onChange={(e) => handlePreferenceChange(setting.key, e.target.value)}
                          className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {setting.options?.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : setting.type === 'number' ? (
                        <input
                          type="number"
                          min={setting.min}
                          max={setting.max}
                          value={preferences[setting.key] as number}
                          onChange={(e) => handlePreferenceChange(setting.key, parseInt(e.target.value) || 0)}
                          className="w-20 border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="text-sm text-gray-600">
            <p>These settings will be applied to all new practice sessions. You can override them when creating individual practice quizzes.</p>
          </div>
        </div>
      </div>
    </div>
  )
}