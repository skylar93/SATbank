'use client'

import { cn } from '@/lib/utils'

interface LoadingOverlayProps {
  isVisible: boolean
  message?: string
  className?: string
}

export function LoadingOverlay({
  isVisible,
  message = 'Loading...',
  className
}: LoadingOverlayProps) {
  if (!isVisible) return null

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2',
        'flex items-center space-x-2 min-w-[120px] animate-in slide-in-from-top-2 fade-in',
        className
      )}
    >
      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      <span className="text-sm text-gray-700">{message}</span>
    </div>
  )
}