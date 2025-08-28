'use client'

import { Suspense } from 'react'
import ReportsPageContent from './ReportsPageContent'

// Loading component for Suspense boundary
function ReportsLoading() {
  return (
    <div>
      <div className="bg-white rounded-lg shadow-sm px-6 py-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600">Loading reports...</p>
          </div>
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold animate-pulse">A</span>
          </div>
        </div>
      </div>
      <div className="text-center py-12">
        <p className="text-gray-600">Loading reports...</p>
      </div>
    </div>
  )
}

// Client Component - no server-side auth check
export default function AdminReportsPage() {
  return (
    <Suspense fallback={<ReportsLoading />}>
      <ReportsPageContent />
    </Suspense>
  )
}