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

// Helper functions for visible text processing
function isVisibleTextNode(n: Node): n is Text {
  if (n.nodeType !== Node.TEXT_NODE) return false
  const el = n.parentElement
  if (!el) return false
  const tag = el.tagName
  if (['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE'].includes(tag)) return false
  const cs = window.getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden') return false
  if (el.getAttribute('aria-hidden') === 'true') return false
  return true
}

function getTextWalker(root: Node) {
  return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return isVisibleTextNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    }
  })
}

function getVisiblePlainText(container: Element) {
  const walker = getTextWalker(container)
  let s = ''
  while (walker.nextNode()) s += (walker.currentNode as Text).data
  return s
}

function computeOffsetsWithoutTrim(container: Element, range: Range, textRaw: string) {
  // Enhanced offset calculation with better accuracy
  const walker = getTextWalker(container)
  let idx = 0
  let start = -1
  let end = -1

  // Find start position
  // Reset walker by creating a new one
  while (walker.nextNode()) {
    const t = walker.currentNode as Text
    if (t === range.startContainer) {
      start = idx + range.startOffset
      break
    }
    idx += t.data.length
  }

  // Find end position
  if (start >= 0) {
    if (range.startContainer === range.endContainer) {
      // Same text node
      end = start + (range.endOffset - range.startOffset)
    } else {
      // Different text nodes - continue walking
      while (walker.nextNode()) {
        const t = walker.currentNode as Text
        if (t === range.endContainer) {
          end = idx + range.endOffset
          break
        }
        idx += t.data.length
      }
    }
  }

  // Fallback to text search if direct position calculation failed
  if (start < 0 || end < 0) {
    const containerText = getVisiblePlainText(container)
    const foundStart = containerText.indexOf(textRaw)
    if (foundStart >= 0) {
      start = foundStart
      end = foundStart + textRaw.length
    }
  }

  // Ensure we have valid positions
  if (start < 0) start = 0
  if (end < 0) end = start + textRaw.length

  return { start, end, textForHighlight: textRaw }
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
  const isStickyRef = useRef(false) // Sticky selection mode
  const isRestoringRef = useRef(false) // Prevent selection change loops

  const scheduleHide = (ms: number) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current && !isStickyRef.current) {
        setIsVisible(false)
      }
    }, ms)
  }

  useEffect(() => {
    const handleSelectionChange = () => {
      if (isRestoringRef.current) return

      const selection = window.getSelection()

      // Clear any pending hide timeout when selection changes
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }

      if (!selection || !containerRef.current || selection.rangeCount === 0) {
        // Only hide if we don't have sticky selection
        if (isStickyRef.current) return
        // Non-sticky mode: delay hide to allow user interaction
        if (!selectedText) {
          scheduleHide(1500)
        }
        return
      }

      const range = selection.getRangeAt(0)
      const textRaw = selection.toString() // Don't trim for offset calculations

      if (
        !textRaw ||
        !containerRef.current.contains(range.commonAncestorContainer)
      ) {
        // Only hide if we don't have sticky selection
        if (!isStickyRef.current && !selectedText) {
          scheduleHide(1500)
        }
        return
      }

      // Valid selection found → activate sticky mode
      isStickyRef.current = true
      storedRangeRef.current = range.cloneRange()

      // Calculate text offsets using improved approach
      const containerElement = containerRef.current

      // Find the actual content container for accurate offset calculation
      let actualContainer = containerElement
      const contentDiv = containerElement.querySelector('div[style*="font-family"], .max-w-none, [data-math]')
      if (contentDiv && contentDiv instanceof HTMLElement) {
        actualContainer = contentDiv
      }

      // Validate that the range is within our container
      if (!actualContainer.contains(range.commonAncestorContainer)) {
        console.warn('Selection range is outside target container')
        return
      }

      const { start, end, textForHighlight } = computeOffsetsWithoutTrim(actualContainer, range, textRaw)

      // Additional validation
      if (start < 0 || end <= start) {
        console.warn('Invalid selection offsets calculated:', { start, end, textForHighlight })
        return
      }
      
      // Debug: uncomment for troubleshooting selection issues
      // console.log('Selection debug in FloatingHighlightButton:', {
      //   selectedText: textForHighlight,
      //   selectedLength: textForHighlight.length,
      //   calculatedStart: start,
      //   calculatedEnd: end,
      //   containerText: getVisiblePlainText(actualContainer).substring(0, 200)
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

      setSelectedText(textForHighlight)
      setSelectionRange({ start, end })
      setIsVisible(true)
    }

    const handleClickOutside = (e: MouseEvent) => {
      // Don't hide immediately if clicking on the button
      if (buttonRef.current && buttonRef.current.contains(e.target as Node)) {
        return
      }

      // Give user more time to move to the button
      scheduleHide(2000)
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

  const clearSelectionAndUI = () => {
    storedRangeRef.current = null
    window.getSelection()?.removeAllRanges()
    setSelectedText('')
    setSelectionRange(null)
    isStickyRef.current = false
    setIsVisible(false)
  }

  const handleHighlight = () => {
    if (selectionRange && selectedText) {
      onHighlight({
        start: selectionRange.start,
        end: selectionRange.end,
        text: selectedText,
      })

      clearSelectionAndUI()
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
        
        clearSelectionAndUI()
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
    if (!storedRangeRef.current) return
    try {
      isRestoringRef.current = true
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(storedRangeRef.current)
      }
    } catch (error) {
      console.warn('Failed to restore selection:', error)
    } finally {
      // Delay clearing the flag to prevent selectionchange loop
      setTimeout(() => { isRestoringRef.current = false }, 0)
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
    // Start hide timeout when leaving button
    scheduleHide(2000)
  }

  const onButtonMouseDown: React.MouseEventHandler = (e) => {
    e.preventDefault()
    e.stopPropagation()
    restoreSelection()
  }

  if (!isVisible || !containerRef.current) return null

  return (
    <>
      <div
        ref={buttonRef}
        onMouseDown={onButtonMouseDown}
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
