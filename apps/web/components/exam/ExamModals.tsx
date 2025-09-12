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
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-lg mx-4">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-white text-2xl">⚠️</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {existingAttempt.status === 'expired'
                      ? 'Previous Exam Attempt Found'
                      : 'Existing Exam Attempt Found'}
                  </h3>
                  <p className="text-gray-600">
                    {existingAttempt.status === 'expired'
                      ? 'You have a previous exam attempt that was not completed. You can continue from where you left off or start fresh:'
                      : 'You already have an ongoing exam attempt for this test. You can either:'}
                  </p>
                </div>
                
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-6 mb-8">
                  <h4 className="font-medium text-violet-900 mb-3">
                    Current attempt details:
                  </h4>
                  <ul className="text-sm text-violet-800 space-y-2">
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-violet-500 rounded-full mr-3"></span>
                      <strong>Status:</strong>&nbsp;
                      {existingAttempt.status.replace('_', ' ').toUpperCase()}
                    </li>
                    <li className="flex items-center">
                      <span className="w-2 h-2 bg-violet-500 rounded-full mr-3"></span>
                      <strong>Current Module:</strong>&nbsp;
                      {existingAttempt.current_module
                        ?.replace(/(\d)/, ' $1')
                        .toUpperCase()}
                    </li>
                    {existingAttempt.started_at && (
                      <li className="flex items-center">
                        <span className="w-2 h-2 bg-violet-500 rounded-full mr-3"></span>
                        <strong>Started:</strong>&nbsp;
                        {new Date(existingAttempt.started_at).toLocaleString()}
                      </li>
                    )}
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={onContinueExistingAttempt}
                      className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                      disabled={loading}
                    >
                      {loading
                        ? 'Loading...'
                        : existingAttempt.status === 'expired'
                          ? 'Continue Previous'
                          : 'Continue Existing'}
                    </button>
                    <button
                      onClick={onDiscardAndStartNew}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                      disabled={loading}
                    >
                      {loading ? 'Loading...' : 'Start New'}
                    </button>
                  </div>
                  
                  <button
                    onClick={onCloseConflictModal}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium transition-all duration-200"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
