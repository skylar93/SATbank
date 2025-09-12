'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../../contexts/auth-context'
import {
  getResultsDashboardData,
  type ResultsDashboardData,
} from '../../../../lib/results-service'
import ResultsDashboardClient from './ResultsDashboardClient'
import { ChartBarIcon } from '@heroicons/react/24/outline'

export function ResultsPageContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [dashboardData, setDashboardData] =
    useState<ResultsDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    console.log('🔄 ResultsPageContent: Auth state changed', {
      authLoading,
      user: !!user,
      userEmail: user?.email,
    })

    if (!authLoading && user) {
      console.log(
        '🔄 ResultsPageContent: Loading dashboard data for user:',
        user.email
      )
      loadDashboardData()
    } else if (!authLoading && !user) {
      console.log(
        '🔄 ResultsPageContent: No user found, redirecting to dashboard'
      )
      // Redirect to dashboard instead of showing login message
      router.push('/student/dashboard')
    }
  }, [user, authLoading, router])

  const loadDashboardData = async () => {
    try {
      setError(null)
      setLoading(true)
      const data = await getResultsDashboardData(user!.id)
      setDashboardData(data)
    } catch (err: any) {
      console.error('Error loading results dashboard data:', err)
      setError(err.message || 'Failed to load results data')
    } finally {
      setLoading(false)
    }
  }

  // Don't render anything until mounted to avoid hydration issues
  if (!mounted) {
    return null
  }

  // Show auth loading state
  if (authLoading) {
    return (
      <div className="h-full bg-gray-50">
        <div className="bg-white px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Results</h1>
              <p className="text-gray-600">Checking authentication...</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold animate-pulse">•</span>
            </div>
          </div>
          <div className="border-b border-gray-200"></div>
        </div>
      </div>
    )
  }

  // Show not logged in state
  if (!user) {
    return (
      <div className="h-full bg-gray-50">
        <div className="bg-white px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Results</h1>
              <p className="text-gray-600">
                Please log in to view your results
              </p>
            </div>
          </div>
          <div className="border-b border-gray-200"></div>
        </div>
        <div className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-blue-800">
              Please log in to view your exam results.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show data loading state
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
                {user.profile?.full_name?.charAt(0) || 'U'}
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

  // Show error state
  if (error || !dashboardData) {
    return (
      <div className="h-full bg-gray-50">
        <div className="bg-white px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Results</h1>
              <p className="text-gray-600">Error loading results</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user.profile?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
          <div className="border-b border-gray-200"></div>
        </div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-red-800">
              Error loading results: {error || 'Unknown error'}
            </p>
            <button
              onClick={loadDashboardData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show dashboard with data
  return <ResultsDashboardClient initialData={dashboardData} />
}
