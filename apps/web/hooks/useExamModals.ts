import { useState, useCallback } from 'react'

export const useExamModals = () => {
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Handle opening exit confirmation modal
  const openExitConfirm = useCallback(() => {
    setShowExitConfirm(true)
  }, [])

  // Handle closing exit confirmation modal
  const closeExitConfirm = useCallback(() => {
    setShowExitConfirm(false)
  }, [])

  // Handle cancel exit - alias for closeExitConfirm for semantic clarity
  const handleCancelExit = useCallback(() => {
    setShowExitConfirm(false)
  }, [])

  return {
    // State
    showExitConfirm,

    // Actions
    openExitConfirm,
    closeExitConfirm,
    handleCancelExit,
  }
}
