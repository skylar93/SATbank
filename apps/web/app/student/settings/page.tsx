'use client'

import { useState } from 'react'
import { useAuth } from '../../../contexts/auth-context'
import { PracticeSettings } from '../../../components/practice/practice-settings'
import { PracticeProgress } from '../../../components/practice/practice-progress'
import { 
  CogIcon, 
  ChartBarIcon, 
  UserIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  DocumentChartBarIcon,
  ShieldCheckIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline'

export default function StudentSettings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'practice' | 'progress' | 'account'>('practice')

  if (!user) return null

  return (
    <div className="h-full bg-gray-50">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">Customize your practice experience and manage your account</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search settings..."
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - 9 cols */}
          <div className="col-span-12 lg:col-span-9">
            {/* Tab Navigation */}
            <div className="mb-6">
              <nav className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
                <div className="flex space-x-2">
                  {[
                    { id: 'practice', label: 'Practice Settings', icon: AdjustmentsHorizontalIcon },
                    { id: 'progress', label: 'Progress & Analytics', icon: DocumentChartBarIcon },
                    { id: 'account', label: 'Account Settings', icon: ShieldCheckIcon }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 flex-1 justify-center ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </nav>
            </div>

            {/* Content based on active tab */}
            {activeTab === 'practice' && (
              <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <div className="flex items-center space-x-2 mb-6">
                  <AdjustmentsHorizontalIcon className="w-6 h-6 text-violet-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Practice Configuration</h3>
                </div>
                <PracticeSettings />
              </div>
            )}
            
            {activeTab === 'progress' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center space-x-2 mb-6">
                    <DocumentChartBarIcon className="w-6 h-6 text-violet-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Practice Analytics</h2>
                  </div>
                  <p className="text-gray-600 mb-6">
                    Track your practice performance and identify areas for improvement.
                  </p>
                  <PracticeProgress showDetailedStats={true} />
                </div>
              </div>
            )}
            
            {activeTab === 'account' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center space-x-2">
                    <ShieldCheckIcon className="w-6 h-6 text-violet-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Account Information</h2>
                  </div>
                </div>
                
                <div className="p-6 space-y-8">
                  {/* Profile Information */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-6">Profile Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Full Name
                        </label>
                        <div className="px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600">
                          {user.profile?.full_name || 'Not set'}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Email
                        </label>
                        <div className="px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600">
                          {user.profile?.email || user.email}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Grade Level
                        </label>
                        <div className="px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600">
                          {user.profile?.grade_level ? `Grade ${user.profile.grade_level}` : 'Not set'}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Target Score
                        </label>
                        <div className="px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600">
                          {user.profile?.target_score || 'Not set'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Account Actions */}
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-6">Account Actions</h3>
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600 bg-blue-50 p-4 rounded-xl border border-blue-200">
                        To update your profile information, please contact your administrator.
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
                          className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Reset Practice Settings
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Data Export */}
                  <div className="pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-6">Data Export</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Export your practice data and progress for external analysis.
                    </p>
                    <button
                      onClick={() => {
                        // This would ideally call an API to generate a comprehensive data export
                        alert('Data export feature coming soon!')
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg"
                    >
                      Export Data
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - 3 cols */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            {/* Quick Settings Card */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center space-x-2 mb-4">
                <CogIcon className="w-5 h-5 text-violet-600" />
                <h3 className="text-lg font-semibold text-gray-900">Quick Settings</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Sound Effects</span>
                  <input type="checkbox" className="rounded" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Auto Save</span>
                  <input type="checkbox" className="rounded" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Dark Mode</span>
                  <input type="checkbox" className="rounded" />
                </div>
              </div>
            </div>

            {/* Account Summary */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center space-x-2 mb-4">
                <UserIcon className="w-5 h-5 text-violet-600" />
                <h3 className="text-lg font-semibold text-gray-900">Account Summary</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-900">Member Since</span>
                  <span className="text-sm font-semibold text-violet-600">
                    {new Date(user.profile?.created_at || '').getFullYear()}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-900">Account Type</span>
                  <span className="text-sm font-semibold text-green-600">Student</span>
                </div>
              </div>
            </div>

            {/* Help & Support */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-sm p-6 text-white">
              <div className="text-center">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <QuestionMarkCircleIcon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Need Help?</h3>
                <p className="text-blue-100 text-sm mb-4">
                  Contact our support team for assistance with your account or practice sessions.
                </p>
                <button className="bg-white text-blue-600 font-semibold py-2 px-6 rounded-lg hover:bg-blue-50 transition-colors">
                  Contact Support
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}