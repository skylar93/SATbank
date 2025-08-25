import { Suspense } from 'react'
import { ResultsPageContent } from './ResultsPageContent'
import { ChartBarIcon } from '@heroicons/react/24/outline'

// Loading component for Suspense boundary
function ResultsLoading() {
  return (
    <div className="h-full bg-gray-50">
      <div className="bg-white px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Results</h1>
            <p className="text-gray-600">Loading your exam results...</p>
          </div>
          <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold animate-pulse">U</span>
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

// Server Component - optimized data fetching
export default function StudentResultsPage() {
  return (
    <Suspense fallback={<ResultsLoading />}>
      <ResultsPageContent />
    </Suspense>
  )
}
