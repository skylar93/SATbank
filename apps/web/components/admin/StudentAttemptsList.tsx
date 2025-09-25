'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { TrashIcon } from '@heroicons/react/24/outline'
import DeleteAttemptConfirmDialog from './DeleteAttemptConfirmDialog'

interface TestAttemptWithVisibility {
  id: string
  created_at: string
  completed_at: string
  total_score: number
  module_scores: any
  status: string
  answers_visible: boolean
  answers_visible_after: string | null
  final_scores?: {
    overall: number
    [key: string]: any
  }
  exam?: {
    id: string
    title: string
  }
}

interface StudentAttemptsListProps {
  attempts: TestAttemptWithVisibility[]
  onVisibilityUpdate: () => void
  studentName?: string
}

export default function StudentAttemptsList({
  attempts,
  onVisibilityUpdate,
  studentName = 'Student',
}: StudentAttemptsListProps) {
  const [updatingAttempts, setUpdatingAttempts] = useState<Set<string>>(
    new Set()
  )
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [attemptToDelete, setAttemptToDelete] =
    useState<TestAttemptWithVisibility | null>(null)

  const handleVisibilityToggle = async (
    attemptId: string,
    currentVisible: boolean
  ) => {
    setUpdatingAttempts((prev) => new Set(prev).add(attemptId))

    try {
      const { error } = await supabase
        .from('test_attempts')
        .update({
          answers_visible: !currentVisible,
          answers_visible_after: null, // Reset scheduled release when toggling
        })
        .eq('id', attemptId)

      if (error) {
        console.error('Error updating visibility:', error)
        alert('Failed to update answer visibility. Please try again.')
        return
      }

      // Refresh the data in the parent component
      onVisibilityUpdate()
    } catch (error) {
      console.error('Error updating visibility:', error)
      alert('Failed to update answer visibility. Please try again.')
    } finally {
      setUpdatingAttempts((prev) => {
        const newSet = new Set(prev)
        newSet.delete(attemptId)
        return newSet
      })
    }
  }

  const handleDeleteClick = (attempt: TestAttemptWithVisibility) => {
    setAttemptToDelete(attempt)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!attemptToDelete) return

    try {
      const response = await fetch(
        `/api/admin/attempts/${attemptToDelete.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete attempt')
      }

      // Refresh the data in the parent component
      onVisibilityUpdate()

      // Show success message (you can replace with toast notification)
      alert('Test attempt deleted successfully')
    } catch (error) {
      console.error('Error deleting attempt:', error)
      alert(
        `Failed to delete attempt: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setAttemptToDelete(null)
  }

  const getDisplayScore = (attempt: TestAttemptWithVisibility): number => {
    return attempt.final_scores?.overall || attempt.total_score || 0
  }

  const getScoreColor = (score: number) => {
    if (score >= 1200) return 'text-purple-600'
    if (score >= 1000) return 'text-blue-600'
    if (score >= 800) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-purple-100 text-purple-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
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

  const getVisibilityStatus = (attempt: TestAttemptWithVisibility) => {
    if (attempt.answers_visible) {
      return { status: 'Visible', color: 'text-emerald-600' }
    } else if (attempt.answers_visible_after) {
      const releaseDate = new Date(attempt.answers_visible_after)
      const now = new Date()
      if (now >= releaseDate) {
        return { status: 'Visible', color: 'text-emerald-600' }
      } else {
        return {
          status: `Scheduled: ${formatDate(attempt.answers_visible_after)}`,
          color: 'text-orange-600',
        }
      }
    }
    return { status: 'Hidden', color: 'text-gray-600' }
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-purple-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Test Attempts</h3>
        <p className="text-sm text-gray-600 mt-1">
          Manage answer visibility for individual test attempts
        </p>
      </div>

      {attempts.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-gray-500">No test attempts found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Exam
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Answer Visibility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-100">
              {attempts.map((attempt) => {
                const displayScore = getDisplayScore(attempt)
                const visibilityStatus = getVisibilityStatus(attempt)
                const isUpdating = updatingAttempts.has(attempt.id)

                return (
                  <tr
                    key={attempt.id}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {attempt.exam?.title || 'SAT Mock Exam'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {attempt.completed_at
                        ? formatDate(attempt.completed_at)
                        : 'In Progress'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1.5 text-xs font-semibold rounded-full ${getStatusColor(attempt.status)}`}
                      >
                        {attempt.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {attempt.status === 'completed' ? (
                        <div
                          className={`text-sm font-medium ${getScoreColor(displayScore)}`}
                        >
                          {displayScore}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <span
                          className={`text-sm font-medium ${visibilityStatus.color}`}
                        >
                          {visibilityStatus.status}
                        </span>
                        <button
                          onClick={() =>
                            handleVisibilityToggle(
                              attempt.id,
                              attempt.answers_visible
                            )
                          }
                          disabled={
                            isUpdating || attempt.status !== 'completed'
                          }
                          className={`
                            relative inline-flex h-6 w-11 items-center rounded-full transition-colors 
                            ${
                              attempt.answers_visible
                                ? 'bg-emerald-600'
                                : 'bg-gray-200'
                            }
                            ${attempt.status !== 'completed' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            ${isUpdating ? 'opacity-75' : ''}
                          `}
                        >
                          <span
                            className={`
                              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                              ${attempt.answers_visible ? 'translate-x-6' : 'translate-x-1'}
                            `}
                          />
                        </button>
                        {isUpdating && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {attempt.status === 'completed' && (
                          <Link
                            href={`/admin/results/${attempt.id}`}
                            className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 rounded-full border border-blue-200 hover:from-blue-200 hover:to-purple-200 transition-all duration-200 shadow-sm"
                          >
                            View Results
                          </Link>
                        )}
                        <button
                          onClick={() => handleDeleteClick(attempt)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full transition-all duration-200 group"
                          title="Delete this test attempt"
                        >
                          <TrashIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteAttemptConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        attempt={attemptToDelete}
        studentName={studentName}
      />
    </div>
  )
}
