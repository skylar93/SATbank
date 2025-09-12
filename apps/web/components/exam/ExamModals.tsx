'use client'

interface ExamModalsProps {
  // Exit confirmation modal
  showExitConfirm: boolean
  onConfirmExit: () => void
  onCancelExit: () => void

  // Conflict modal
  showConflictModal: boolean
  existingAttempt: any
  exam: any
  loading: boolean
  onContinueExistingAttempt: () => void
  onDiscardAndStartNew: () => void
  onCloseConflictModal: () => void
}

export function ExamModals({
  showExitConfirm,
  onConfirmExit,
  onCancelExit,
  showConflictModal,
  existingAttempt,
  exam,
  loading,
  onContinueExistingAttempt,
  onDiscardAndStartNew,
  onCloseConflictModal,
}: ExamModalsProps) {
  return (
    <>
      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Exit Exam?
            </h3>
            <p className="text-gray-600 mb-6">
              You have an exam in progress. If you exit now, your current
              answers will be lost and will not be saved until you complete the
              current module.
            </p>
            <div className="flex space-x-4">
              <button
                onClick={onCancelExit}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition-colors"
              >
                Continue Exam
              </button>
              <button
                onClick={(e) => {
                  console.log('🚪 Exit Anyway button clicked')
                  e.preventDefault()
                  e.stopPropagation()
                  onConfirmExit()
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Exit Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Modal */}
      {showConflictModal && existingAttempt && exam && (
        <div className="min-h-screen bg-gray-50">
          <div className="flex items-center justify-center min-h-screen">
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-lg mx-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {existingAttempt.status === 'expired'
                    ? 'Previous Exam Attempt Found'
                    : 'Existing Exam Attempt Found'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {existingAttempt.status === 'expired'
                    ? 'You have a previous exam attempt that was not completed. You can continue from where you left off or start fresh:'
                    : 'You already have an ongoing exam attempt for this test. You can either:'}
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-blue-900 mb-2">
                    Current attempt details:
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>
                      • Status:{' '}
                      {existingAttempt.status.replace('_', ' ').toUpperCase()}
                    </li>
                    <li>
                      • Current Module:{' '}
                      {existingAttempt.current_module
                        ?.replace(/(\d)/, ' $1')
                        .toUpperCase()}
                    </li>
                    {existingAttempt.started_at && (
                      <li>
                        • Started:{' '}
                        {new Date(existingAttempt.started_at).toLocaleString()}
                      </li>
                    )}
                  </ul>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={onContinueExistingAttempt}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    {loading
                      ? 'Loading...'
                      : existingAttempt.status === 'expired'
                        ? 'Continue from Previous Attempt'
                        : 'Continue Existing Attempt'}
                  </button>
                  <button
                    onClick={onDiscardAndStartNew}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Discard & Start New'}
                  </button>
                </div>
                <button
                  onClick={onCloseConflictModal}
                  className="w-full mt-3 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
