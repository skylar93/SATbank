'use client'

import { useState, useEffect, useRef } from 'react'
import { Highlighter, Languages } from 'lucide-react'
import { autoAddToVocab } from '@/lib/dictionary-actions'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'

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

      // Improved positioning algorithm for better handling of single-line questions
      const buttonWidth = 90 // Width for both buttons together
      const buttonHeight = 40
      const offset = 8
      const minDistance = 5 // Minimum distance from container edges

      // Get the cursor position (end of selection)
      const tempRange = document.createRange()
      tempRange.setStart(range.endContainer, range.endOffset)
      tempRange.setEnd(range.endContainer, range.endOffset)
      const cursorRect = tempRange.getBoundingClientRect()

      // Get viewport and container dimensions
      const containerWidth = containerElement.offsetWidth
      const containerHeight = containerElement.offsetHeight
      const viewportHeight = window.innerHeight

      // Calculate available space in all directions
      const spaceRight = containerWidth - (rect.right - containerRect.left)
      const spaceLeft = rect.left - containerRect.left
      const spaceBelow = containerHeight - (rect.bottom - containerRect.top)
      const spaceAbove = rect.top - containerRect.top

      let buttonX = 0
      let buttonY = 0

      // Horizontal positioning: prefer right, fallback to left if not enough space
      if (spaceRight >= buttonWidth + offset + minDistance) {
        // Position to the right of the cursor
        buttonX = cursorRect.right - containerRect.left + offset
      } else if (spaceLeft >= buttonWidth + offset + minDistance) {
        // Position to the left of selection
        buttonX = rect.left - containerRect.left - buttonWidth - offset
      } else {
        // Center horizontally if neither side has enough space
        buttonX = Math.max(minDistance, (containerWidth - buttonWidth) / 2)
      }

      // Vertical positioning: for single-line questions, be more aggressive about positioning
      if (spaceBelow >= buttonHeight + offset + minDistance) {
        // Position below selection
        buttonY = rect.bottom - containerRect.top + offset
      } else if (spaceAbove >= buttonHeight + offset + minDistance) {
        // Position above selection  
        buttonY = rect.top - containerRect.top - buttonHeight - offset
      } else {
        // For very tight spaces (like single-line questions), position at a safe distance
        // Try to position below first, but with minimal offset
        const minimalOffset = 3
        if (rect.bottom - containerRect.top + buttonHeight + minimalOffset <= containerHeight) {
          buttonY = rect.bottom - containerRect.top + minimalOffset
        } else if (rect.top - containerRect.top - buttonHeight - minimalOffset >= 0) {
          buttonY = rect.top - containerRect.top - buttonHeight - minimalOffset
        } else {
          // For extremely tight single-line cases, position the buttons to overlay slightly
          // This ensures they're always visible even if space is very limited
          const selectionMiddleY = rect.top + (rect.height / 2) - containerRect.top
          if (selectionMiddleY - (buttonHeight / 2) >= 0 && 
              selectionMiddleY + (buttonHeight / 2) <= containerHeight) {
            // Center vertically on the selection
            buttonY = selectionMiddleY - (buttonHeight / 2)
          } else {
            // Final fallback: position at the edge with the most space
            buttonY = spaceBelow > spaceAbove ? 
              Math.max(0, containerHeight - buttonHeight) :
              0
          }
        }
      }

      // Final boundary enforcement with more generous margins for single-line cases
      buttonX = Math.max(minDistance, Math.min(buttonX, containerWidth - buttonWidth - minDistance))
      buttonY = Math.max(minDistance, Math.min(buttonY, containerHeight - buttonHeight - minDistance))

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
      toast.error('Please sign in to add vocabulary')
      return
    }

    if (!selectedText) return

    // Basic validation for selected text
    const cleanText = selectedText.trim()
    if (cleanText.length < 2 || cleanText.length > 50) {
      toast.error('Please select a word between 2-50 characters')
      return
    }

    // Check if it's a reasonable word (no excessive punctuation or numbers)
    if (/^[^a-zA-Z]*$/.test(cleanText) || cleanText.split(' ').length > 3) {
      toast.error('Please select a valid word or short phrase')
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
        toast.success(result.message)
        
        // Clear selection
        window.getSelection()?.removeAllRanges()
        setIsVisible(false)
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error('Error adding vocabulary:', error)
      toast.error('Failed to add vocabulary. Please try again.')
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
          maxWidth: '90px', // Prevent buttons from growing too wide
          minHeight: '40px', // Ensure minimum height for visibility
        }}
      >
        {/* Highlight Button */}
        <button
          onClick={handleHighlight}
          className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 p-2 rounded-full shadow-xl border-2 border-white transition-all duration-200 ease-in-out transform hover:scale-110 flex-shrink-0"
          title="Highlight selected text"
          style={{ minWidth: '36px', minHeight: '36px' }}
        >
          <Highlighter size={16} />
        </button>

        {/* Add to Vocab Button */}
        <button
          onClick={handleAddToVocab}
          disabled={isAddingVocab}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white p-2 rounded-full shadow-xl border-2 border-white transition-all duration-200 ease-in-out transform hover:scale-110 flex-shrink-0"
          title={`Add "${selectedText}" to vocabulary`}
          style={{ minWidth: '36px', minHeight: '36px' }}
        >
          {isAddingVocab ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <Languages size={16} />
          )}
        </button>
      </div>
    </>
  )
}
