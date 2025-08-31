'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../../contexts/auth-context'
import { supabase } from '../../../../lib/supabase'
import ReportsClient from '../../../../components/admin/ReportsClient'

interface AttemptData {
  attempt_id: string
  completed_at: string
  duration_seconds: number
  final_scores: {
    english?: number
    math?: number
  } | null
  student_id: string
  student_full_name: string
  student_email: string
  exam_id: string
  exam_title: string
}

export default function ReportsPageContent() {
  const { user, loading: authLoading, isAdmin } = useAuth()
  const router = useRouter()
  const [attempts, setAttempts] = useState<AttemptData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    console.log('🔄 ReportsPageContent: Auth state changed', {
      authLoading,
      user: !!user,
      isAdmin,
    })

    if (!authLoading && user && isAdmin) {
      console.log(
        '🔄 ReportsPageContent: Loading report data for admin:',
        user.email
      )
      loadReportData()
    } else if (!authLoading && (!user || !isAdmin)) {
      console.log('🔄 ReportsPageContent: Not authorized, redirecting to login')
      router.push('/login')
    }
  }, [user, authLoading, isAdmin, router])

  const loadReportData = async () => {
    try {
      setError(null)
      setLoading(true)

      const { data, error } = await supabase.rpc('get_admin_report_attempts')

      if (error) {
        console.error('Error fetching report attempts:', error)
        setError(error.message || 'Failed to load report data')
        return
      }

      setAttempts(data || [])
    } catch (err: any) {
      console.error('Error loading report data:', err)
      setError(err.message || 'Failed to load report data')
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
      <div>
        <div className="bg-white rounded-lg shadow-sm px-6 py-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
              <p className="text-gray-600">Checking authentication...</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold animate-pulse">•</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show not authorized state
  if (!user || !isAdmin) {
    return (
      <div>
        <div className="bg-white rounded-lg shadow-sm px-6 py-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
              <p className="text-gray-600">Access denied</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            You don&apos;t have permission to access this page. Admin access
            required.
          </p>
        </div>
      </div>
    )
  }

  // Show data loading state
  if (loading) {
    return (
      <div>
        <div className="bg-white rounded-lg shadow-sm px-6 py-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
              <p className="text-gray-600">Loading reports...</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user.email?.charAt(0)?.toUpperCase() || 'A'}
              </span>
            </div>
          </div>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div>
        <div className="bg-white rounded-lg shadow-sm px-6 py-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
              <p className="text-gray-600">Error loading reports</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user.email?.charAt(0)?.toUpperCase() || 'A'}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading reports: {error}</p>
          <button
            onClick={loadReportData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Show reports with data
  return (
    <div>
      {/* Top Header Section */}
      <div className="bg-white rounded-lg shadow-sm px-6 py-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold">
                {user.email?.charAt(0)?.toUpperCase() || 'A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <ReportsClient attempts={attempts} />
    </div>
  )
}
