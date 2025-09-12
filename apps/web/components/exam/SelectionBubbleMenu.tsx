'use client'

import { useState, useEffect, useCallback } from 'react'
import { autoAddToVocab } from '@/lib/dictionary-actions'
import { useAuth } from '@/contexts/auth-context'

interface BubbleMenuState {
  visible: boolean
  x: number
  y: number
  selectedText: string
  range: Range | null
}

interface SelectionBubbleMenuProps {
  examTitle?: string | null
  examId?: string | null
  onHighlight?: (text: string, range: Range) => void
  className?: string
}

export function SelectionBubbleMenu({
  examTitle,
  examId,
  onHighlight,
  className = '',
}: SelectionBubbleMenuProps) {
  const { user } = useAuth()
  const [menuState, setMenuState] = useState<BubbleMenuState>({
    visible: false,
    x: 0,
    y: 0,
    selectedText: '',
    range: null,
  })
  const [isAddingVocab, setIsAddingVocab] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string
    type: 'success' | 'error'
  } | null>(null)

  const showFeedback = useCallback(
    (text: string, type: 'success' | 'error') => {
      setFeedbackMessage({ text, type })
      setTimeout(() => setFeedbackMessage(null), 3000)
    },
    []
  )

  const handleSelection = useCallback(() => {
    const selection = window.getSelection()

    if (!selection || selection.rangeCount === 0) {
      setMenuState((prev) => ({ ...prev, visible: false }))
      return
    }

    const selectedText = selection.toString().trim()
    const range = selection.getRangeAt(0)

    // Only show menu for meaningful text selections (1-3 words, reasonable length)
    if (
      !selectedText ||
      selectedText.length < 2 ||
      selectedText.length > 50 ||
      selectedText.split(' ').length > 3 ||
      /^\s*$/.test(selectedText)
    ) {
      setMenuState((prev) => ({ ...prev, visible: false }))
      return
    }

    // Get selection position
    const rect = range.getBoundingClientRect()
    const scrollY = window.scrollY || document.documentElement.scrollTop
    const scrollX = window.scrollX || document.documentElement.scrollLeft

    // Position menu above and centered on selection
    const x = rect.left + scrollX + rect.width / 2
    const y = rect.top + scrollY - 10 // 10px above selection

    setMenuState({
      visible: true,
      x,
      y,
      selectedText,
      range,
    })
  }, [])

  const hideBubbleMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, visible: false }))
  }, [])

  useEffect(() => {
    // Handle text selection
    document.addEventListener('mouseup', handleSelection)
    document.addEventListener('keyup', handleSelection)

    // Hide menu when clicking elsewhere
    document.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement
      if (!target.closest('.selection-bubble-menu')) {
        hideBubbleMenu()
      }
    })

    return () => {
      document.removeEventListener('mouseup', handleSelection)
      document.removeEventListener('keyup', handleSelection)
      document.removeEventListener('mousedown', hideBubbleMenu)
    }
  }, [handleSelection, hideBubbleMenu])

  const handleHighlight = async () => {
    if (!menuState.range || !onHighlight) return

    onHighlight(menuState.selectedText, menuState.range)
    hideBubbleMenu()
  }

  const handleAddToVocab = async () => {
    if (!user) {
      showFeedback('Please sign in to add vocabulary', 'error')
      return
    }

    if (!menuState.selectedText) return

    setIsAddingVocab(true)

    try {
      const result = await autoAddToVocab(
        menuState.selectedText,
        examTitle,
        examId
      )

      if (result.success) {
        showFeedback(result.message, 'success')

        // Clear selection
        const selection = window.getSelection()
        if (selection) {
          selection.removeAllRanges()
        }
      } else {
        showFeedback(result.message, 'error')
      }
    } catch (error) {
      console.error('Error adding vocabulary:', error)
      showFeedback('Failed to add vocabulary. Please try again.', 'error')
    } finally {
      setIsAddingVocab(false)
      hideBubbleMenu()
    }
  }

  if (!menuState.visible) {
    return (
      <>
        {/* Feedback Toast */}
        {feedbackMessage && (
          <div
            className={`fixed top-4 right-4 z-[9999] px-4 py-2 rounded-lg shadow-lg max-w-sm transition-all duration-300 ${
              feedbackMessage.type === 'success'
                ? 'bg-green-100 border border-green-300 text-green-800'
                : 'bg-red-100 border border-red-300 text-red-800'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">
                {feedbackMessage.type === 'success' ? '✅' : '❌'}
              </span>
              <span className="text-sm">{feedbackMessage.text}</span>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {/* Bubble Menu */}
      <div
        className={`selection-bubble-menu fixed z-[9998] transform -translate-x-1/2 -translate-y-full ${className}`}
        style={{
          left: `${menuState.x}px`,
          top: `${menuState.y}px`,
        }}
      >
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-2 flex items-center space-x-2 animate-in fade-in-0 zoom-in-95 duration-200">
          {/* Highlight Button */}
          {onHighlight && (
            <button
              onClick={handleHighlight}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Highlight this text"
            >
              <span className="text-yellow-500">🔍</span>
              <span>Highlight</span>
            </button>
          )}

          {/* Add to Vocab Button */}
          <button
            onClick={handleAddToVocab}
            disabled={isAddingVocab}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-md transition-all duration-200 shadow-lg"
            title={`Add "${menuState.selectedText}" to vocabulary`}
          >
            <span className="text-white">{isAddingVocab ? '⏳' : '📖'}</span>
            <span>{isAddingVocab ? 'Adding...' : 'Add to Vocab'}</span>
          </button>
        </div>

        {/* Arrow pointing down to selection */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2">
          <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white"></div>
          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-200"></div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`fixed top-4 right-4 z-[9999] px-4 py-2 rounded-lg shadow-lg max-w-sm transition-all duration-300 animate-in slide-in-from-right-4 ${
            feedbackMessage.type === 'success'
              ? 'bg-green-100 border border-green-300 text-green-800'
              : 'bg-red-100 border border-red-300 text-red-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">
              {feedbackMessage.type === 'success' ? '✅' : '❌'}
            </span>
            <span className="text-sm">{feedbackMessage.text}</span>
          </div>
        </div>
      )}
    </>
  )
}
