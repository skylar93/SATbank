'use client'

import { useState, useEffect, useRef } from 'react'
import { Highlighter, Languages } from 'lucide-react'
import { autoAddToVocab } from '@/lib/dictionary-actions'
import { useAuth } from '@/contexts/auth-context'

interface Highlight {
  start: number
  end: number
  text: string
}

interface FloatingHighlightButtonProps {
  containerRef: React.RefObject<HTMLElement>
  onHighlight: (highlight: Highlight) => void
  examTitle?: string
  examId?: string
}

export default function FloatingHighlightButton({
  containerRef,
  onHighlight,
  examTitle,
  examId,
}: FloatingHighlightButtonProps) {
  const { user } = useAuth()
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState<{
    start: number
    end: number
  } | null>(null)
  const buttonRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isHoveringRef = useRef(false)
  const [isAddingVocab, setIsAddingVocab] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string
    type: 'success' | 'error'
  } | null>(null)

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setFeedbackMessage({ text, type })
    setTimeout(() => setFeedbackMessage(null), 3000)
  }

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()

      // Clear any pending hide timeout when selection changes
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }

      if (!selection || !containerRef.current || selection.rangeCount === 0) {
        // Delay hiding to give user time to move to the button
        hideTimeoutRef.current = setTimeout(() => {
          if (!isHoveringRef.current) {
            setIsVisible(false)
          }
        }, 300)
        return
      }

      const range = selection.getRangeAt(0)
      const text = selection.toString().trim()

      if (
        !text ||
        !containerRef.current.contains(range.commonAncestorContainer)
      ) {
        // Delay hiding to give user time to move to the button
        hideTimeoutRef.current = setTimeout(() => {
          if (!isHoveringRef.current) {
            setIsVisible(false)
          }
        }, 300)
        return
      }

      // Calculate text offsets within the container
      const containerElement = containerRef.current
      const preSelectionRange = document.createRange()
      preSelectionRange.selectNodeContents(containerElement)
      preSelectionRange.setEnd(range.startContainer, range.startOffset)
      const start = preSelectionRange.toString().length

      const end = start + text.length

      // Get selection position for floating button
      const rect = range.getBoundingClientRect()
      const containerRect = containerElement.getBoundingClientRect()

      // Simple and natural positioning algorithm - adjusted for two buttons
      const buttonWidth = 90 // Width for both buttons together
      const buttonHeight = 40
      const offset = 8

      // Get the cursor position (end of selection)
      const tempRange = document.createRange()
      tempRange.setStart(range.endContainer, range.endOffset)
      tempRange.setEnd(range.endContainer, range.endOffset)
      const cursorRect = tempRange.getBoundingClientRect()

      const containerWidth = containerElement.offsetWidth
      const containerHeight = containerElement.offsetHeight

      // Default position: right and below the cursor
      let buttonX = cursorRect.right - containerRect.left + offset
      let buttonY = rect.bottom - containerRect.top + offset

      // Simple horizontal boundary check
      if (buttonX + buttonWidth > containerWidth) {
        // Position to the left of selection if no space on the right
        buttonX = rect.left - containerRect.left - buttonWidth - offset
      }

      // Simple vertical boundary check - only move up if absolutely necessary
      if (buttonY + buttonHeight > containerHeight) {
        // Only move above selection if there's no other choice
        buttonY = rect.top - containerRect.top - buttonHeight - offset
      }

      // Final boundary enforcement (keep within container)
      buttonX = Math.max(5, Math.min(buttonX, containerWidth - buttonWidth - 5))
      buttonY = Math.max(
        5,
        Math.min(buttonY, containerHeight - buttonHeight - 5)
      )

      setPosition({
        x: buttonX,
        y: buttonY,
      })

      setSelectedText(text)
      setSelectionRange({ start, end })
      setIsVisible(true)
    }

    const handleClickOutside = (e: MouseEvent) => {
      // Don't hide immediately if clicking on the button
      if (buttonRef.current && buttonRef.current.contains(e.target as Node)) {
        return
      }

      // Give user more time to move to the button
      hideTimeoutRef.current = setTimeout(() => {
        if (!isHoveringRef.current) {
          setIsVisible(false)
        }
      }, 500)
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Keep button visible if user is moving towards it
      if (buttonRef.current && isVisible) {
        const buttonRect = buttonRef.current.getBoundingClientRect()
        const distance = Math.sqrt(
          Math.pow(e.clientX - (buttonRect.left + buttonRect.width / 2), 2) +
            Math.pow(e.clientY - (buttonRect.top + buttonRect.height / 2), 2)
        )

        // If user is close to button (within 50px), keep it visible
        if (distance < 50 && hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current)
          hideTimeoutRef.current = null
        }
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('mousemove', handleMouseMove)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('mousemove', handleMouseMove)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [containerRef, isVisible])

  const handleHighlight = () => {
    if (selectionRange && selectedText) {
      onHighlight({
        start: selectionRange.start,
        end: selectionRange.end,
        text: selectedText,
      })

      // Clear selection and hide button
      window.getSelection()?.removeAllRanges()
      setIsVisible(false)
    }
  }

  const handleAddToVocab = async () => {
    if (!user) {
      showFeedback('Please sign in to add vocabulary', 'error')
      return
    }

    if (!selectedText) return

    // Basic validation for selected text
    const cleanText = selectedText.trim()
    if (cleanText.length < 2 || cleanText.length > 50) {
      showFeedback('Please select a word between 2-50 characters', 'error')
      return
    }

    // Check if it's a reasonable word (no excessive punctuation or numbers)
    if (/^[^a-zA-Z]*$/.test(cleanText) || cleanText.split(' ').length > 3) {
      showFeedback('Please select a valid word or short phrase', 'error')
      return
    }

    setIsAddingVocab(true)

    try {
      const result = await autoAddToVocab(
        cleanText,
        examTitle,
        examId
      )

      if (result.success) {
        showFeedback(result.message, 'success')
        
        // Clear selection
        window.getSelection()?.removeAllRanges()
        setIsVisible(false)
      } else {
        showFeedback(result.message, 'error')
      }
    } catch (error) {
      console.error('Error adding vocabulary:', error)
      showFeedback('Failed to add vocabulary. Please try again.', 'error')
    } finally {
      setIsAddingVocab(false)
    }
  }

  const handleMouseEnter = () => {
    isHoveringRef.current = true
    // Clear any pending hide timeout when hovering
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }

  const handleMouseLeave = () => {
    isHoveringRef.current = false
    // Start hide timeout when leaving button
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false)
    }, 800) // Give extra time after leaving the button
  }

  if (!isVisible || !containerRef.current) return null

  return (
    <>
      <div
        ref={buttonRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="absolute z-50 flex space-x-2 transition-all duration-200 ease-in-out"
        style={{
          left: position.x,
          top: position.y,
        }}
      >
        {/* Highlight Button */}
        <button
          onClick={handleHighlight}
          className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 p-2 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-110"
          title="Highlight selected text"
        >
          <Highlighter size={16} />
        </button>

        {/* Add to Vocab Button */}
        <button
          onClick={handleAddToVocab}
          disabled={isAddingVocab}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white p-2 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-110"
          title={`Add "${selectedText}" to vocabulary`}
        >
          {isAddingVocab ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <Languages size={16} />
          )}
        </button>
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
