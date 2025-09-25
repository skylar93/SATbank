'use client'

import { useState } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface TestAttempt {
  id: string
  created_at: string
  completed_at: string
  total_score: number
  status: string
  exam?: {
    id: string
    title: string
  }
}

interface DeleteAttemptConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  attempt: TestAttempt | null
  studentName: string
}

export default function DeleteAttemptConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  attempt,
  studentName,
}: DeleteAttemptConfirmDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const requiredText = 'DELETE'
  const isConfirmValid = confirmText.trim() === requiredText

  const handleConfirm = async () => {
    if (!isConfirmValid) return

    setIsDeleting(true)
    try {
      await onConfirm()
      setConfirmText('')
      onClose()
    } catch (error) {
      console.error('Error during deletion:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClose = () => {
    if (isDeleting) return
    setConfirmText('')
    onClose()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!isOpen || !attempt) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl border border-red-200 max-w-lg w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-red-200 bg-red-50 rounded-t-2xl">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600 mr-3" />
            <h3 className="text-lg font-semibold text-red-900">
              Delete Test Attempt
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium mb-2">
              ⚠️ This action cannot be undone!
            </p>
            <p className="text-red-700 text-sm">
              You are about to permanently delete all data for this test
              attempt, including:
            </p>
            <ul className="text-red-700 text-sm mt-2 list-disc list-inside space-y-1">
              <li>All answer records</li>
              <li>Score data and analytics</li>
              <li>Time tracking information</li>
            </ul>
          </div>

          {/* Attempt Details */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Attempt Details:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Student:</span>
                <span className="font-medium text-gray-900">{studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Exam:</span>
                <span className="font-medium text-gray-900">
                  {attempt.exam?.title || 'SAT Mock Exam'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completed:</span>
                <span className="font-medium text-gray-900">
                  {attempt.completed_at
                    ? formatDate(attempt.completed_at)
                    : 'In Progress'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Score:</span>
                <span className="font-medium text-gray-900">
                  {attempt.status === 'completed' ? attempt.total_score : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              To confirm deletion, please type{' '}
              <strong className="text-red-600">DELETE</strong> below:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              disabled={isDeleting}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-end space-x-3">
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmValid || isDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Deleting...
              </>
            ) : (
              'Delete Permanently'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
