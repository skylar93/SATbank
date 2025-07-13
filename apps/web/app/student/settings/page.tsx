'use client'

import { useState } from 'react'
import { useAuth } from '../../../contexts/auth-context'
import { Navigation } from '../../../components/navigation'
import { PracticeSettings } from '../../../components/practice/practice-settings'
import { PracticeProgress } from '../../../components/practice/practice-progress'

export default function StudentSettings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'practice' | 'progress' | 'account'>('practice')

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="mt-2 text-gray-600">
              Customize your practice experience and view your progress
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('practice')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'practice'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Practice Settings
              </button>
              <button
                onClick={() => setActiveTab('progress')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'progress'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Progress & Analytics
              </button>
              <button
                onClick={() => setActiveTab('account')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'account'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Account Settings
              </button>
            </nav>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'practice' && <PracticeSettings />}
          
          {activeTab === 'progress' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-medium text-gray-900 mb-4">Practice Analytics</h2>
                <p className="text-gray-600 mb-6">
                  Track your practice performance and identify areas for improvement.
                </p>
              </div>
              <PracticeProgress showDetailedStats={true} />
            </div>
          )}
          
          {activeTab === 'account' && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-medium text-gray-900">Account Information</h2>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Profile Information */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                        {user.profile?.full_name || 'Not set'}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                        {user.profile?.email || user.email}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Grade Level
                      </label>
                      <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                        {user.profile?.grade_level ? `Grade ${user.profile.grade_level}` : 'Not set'}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Target Score
                      </label>
                      <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                        {user.profile?.target_score || 'Not set'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Actions */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Account Actions</h3>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      To update your profile information, please contact your administrator.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => {
                          // Clear all local storage practice data
                          const keys = Object.keys(localStorage)
                          keys.forEach(key => {
                            if (key.startsWith('practice_') || key.includes(user.id || '')) {
                              localStorage.removeItem(key)
                            }
                          })
                          alert('Practice data cleared successfully!')
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Clear Practice Data
                      </button>
                      
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to reset all your practice settings to defaults?')) {
                            localStorage.removeItem(`practice_preferences_${user.id}`)
                            window.location.reload()
                          }
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Reset Practice Settings
                      </button>
                    </div>
                  </div>
                </div>

                {/* Data Export */}
                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Data Export</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Export your practice data and progress for external analysis.
                  </p>
                  <button
                    onClick={() => {
                      // This would ideally call an API to generate a comprehensive data export
                      alert('Data export feature coming soon!')
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Export Data
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}