'use client'

import { ClockIcon } from '@heroicons/react/24/outline'

interface TimeExpiredOverlayProps {
  isLastModule?: boolean
}

export function TimeExpiredOverlay({ isLastModule = false }: TimeExpiredOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 border-2 border-red-200 shadow-xl">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <ClockIcon className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Time's Up!
          </h3>
          <p className="text-gray-600 mb-4">
            {isLastModule
              ? 'Submitting your exam and calculating final scores...'
              : 'Moving to the next module...'}
          </p>
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 border-4 border-gray-200 border-t-red-500 rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">
              {isLastModule ? 'Finalizing exam...' : 'Preparing next module...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}