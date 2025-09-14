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

interface DOMHighlight {
  startXPath: string
  startOffset: number
  endXPath: string
  endOffset: number
  text: string
  html?: string
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
  const storedRangeRef = useRef<Range | null>(null) // Store the actual Range object

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()

      // Clear any pending hide timeout when selection changes
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }

      if (!selection || !containerRef.current || selection.rangeCount === 0) {
        // Only hide if we don't have selected text stored (user cleared selection manually)
        // Give more time for user to interact with the button
        if (!selectedText) {
          hideTimeoutRef.current = setTimeout(() => {
            if (!isHoveringRef.current) {
              setIsVisible(false)
            }
          }, 1000) // Increased from 300ms to 1000ms
        }
        return
      }

      const range = selection.getRangeAt(0)
      const text = selection.toString().trim()

      if (
        !text ||
        !containerRef.current.contains(range.commonAncestorContainer)
      ) {
        // Only hide if we don't have selected text stored
        if (!selectedText) {
          hideTimeoutRef.current = setTimeout(() => {
            if (!isHoveringRef.current) {
              setIsVisible(false)
            }
          }, 1000) // Increased timeout
        }
        return
      }

      // Store the range for later restoration
      storedRangeRef.current = range.cloneRange()

      // Calculate text offsets within the container
      const containerElement = containerRef.current
      
      // Improved text offset calculation that finds the actual content container
      const calculateTextOffset = (container: Element, targetNode: Node, targetOffset: number): number => {
        try {
          // Find the actual content container (the div that contains the rendered content)
          // This might be nested inside wrapper divs created by HighlightedTextRenderer
          let actualContainer = container
          
          // Look for the div with dangerouslySetInnerHTML or ContentRenderer content
          const contentDiv = container.querySelector('div[style*="font-family"], .max-w-none, [data-math]')
          if (contentDiv) {
            actualContainer = contentDiv as Element
          }
          
          // Use the simple range-based approach on the actual content container
          const preSelectionRange = document.createRange()
          preSelectionRange.selectNodeContents(actualContainer)
          preSelectionRange.setEnd(targetNode, targetOffset)
          
          // Get the text content of just the range
          const rangeText = preSelectionRange.toString()
          
          // Debug: uncomment for troubleshooting offset calculations
          // console.log('Text offset calculation:', {
          //   containerText: (actualContainer.textContent || '').substring(0, 100),
          //   rangeText: rangeText.substring(0, 100),
          //   calculatedOffset: rangeText.length
          // })
          
          return rangeText.length
        } catch (error) {
          console.warn('Text offset calculation failed, using fallback:', error)
          
          // Enhanced fallback: try to find the selection text within the container
          const containerText = container.textContent || ''
          const selectionText = text.trim()
          
          // Find all occurrences of the selection text
          let index = -1
          let searchStart = 0
          
          // Try to find the selection that matches the actual DOM position
          while ((index = containerText.indexOf(selectionText, searchStart)) !== -1) {
            // This is a rough approximation - in practice, you'd want more sophisticated matching
            const beforeText = containerText.substring(0, index)
            
            // Create a temporary range to check if this matches our selection
            try {
              const testRange = document.createRange()
              testRange.selectNodeContents(container)
              testRange.setStart(testRange.startContainer, 0)
              
              // If the length matches, this is likely our selection
              if (beforeText.length <= index + selectionText.length) {
                return index
              }
            } catch (e) {
              // Continue searching
            }
            
            searchStart = index + 1
          }
          
          return Math.max(0, index)
        }
      }
      
      const start = calculateTextOffset(containerElement, range.startContainer, range.startOffset)
      const end = start + text.length
      
      // Debug: uncomment for troubleshooting selection issues
      // console.log('Selection debug in FloatingHighlightButton:', {
      //   selectedText: text,
      //   selectedLength: text.length,
      //   calculatedStart: start,
      //   calculatedEnd: end,
      //   containerText: (containerElement.textContent || '').substring(0, 200)
      // })

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

      // Give user more time to move to the button - increased timeout
      hideTimeoutRef.current = setTimeout(() => {
        if (!isHoveringRef.current) {
          setIsVisible(false)
        }
      }, 2000) // Increased from 500ms to 2000ms
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Keep button visible if user is moving towards it
      if (buttonRef.current && isVisible) {
        const buttonRect = buttonRef.current.getBoundingClientRect()
        const distance = Math.sqrt(
          Math.pow(e.clientX - (buttonRect.left + buttonRect.width / 2), 2) +
            Math.pow(e.clientY - (buttonRect.top + buttonRect.height / 2), 2)
        )

        // If user is close to button (within 50px), keep it visible and restore selection
        if (distance < 50) {
          if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current)
            hideTimeoutRef.current = null
          }
          // Restore selection when user approaches the button
          restoreSelection()
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

      // Clear stored range and selection, then hide button
      storedRangeRef.current = null
      window.getSelection()?.removeAllRanges()
      setSelectedText('')
      setSelectionRange(null)
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
        
        // Clear stored range and selection
        storedRangeRef.current = null
        window.getSelection()?.removeAllRanges()
        setSelectedText('')
        setSelectionRange(null)
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

  const restoreSelection = () => {
    if (storedRangeRef.current) {
      try {
        const selection = window.getSelection()
        if (selection) {
          selection.removeAllRanges()
          selection.addRange(storedRangeRef.current)
        }
      } catch (error) {
        console.warn('Failed to restore selection:', error)
      }
    }
  }

  const handleMouseEnter = () => {
    isHoveringRef.current = true
    // Clear any pending hide timeout when hovering
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    
    // Restore selection when hovering over button
    restoreSelection()
  }

  const handleMouseLeave = () => {
    isHoveringRef.current = false
    // Start hide timeout when leaving button - increased timeout
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false)
    }, 2000) // Increased from 800ms to 2000ms for better UX
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
