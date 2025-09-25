'use client'

import { useState, useEffect, useRef } from 'react'
import { Highlighter, Languages } from 'lucide-react'
import { autoAddToVocab } from '@/lib/dictionary-actions'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import {
  Highlight,
  getVisiblePlainText,
  getTextWalker,
  findFlexibleWhitespaceMatch,
  sanitizeHtmlContainer,
  findBestTextMatch,
} from './text-utils'

function computeOffsetsWithoutTrim(
  container: Element,
  range: Range,
  textRaw: string
) {
  // Create a temporary normalized container that mimics what HighlightedTextRenderer does
  const normalizedContainer = createNormalizedContainerForSelection(container)

  try {
    // Get normalized plain text using the same method as HighlightedTextRenderer
    const visibleText = getVisiblePlainText(normalizedContainer)

    // NEW: Try to compute accurate offsets by walking through DOM nodes
    let start = -1
    let end = -1
    let textForHighlight = textRaw.trim() // Use local variable instead of mutating parameter

    try {
      // Map original range nodes to normalized container
      const mappedOffsets = mapRangeToNormalizedContainer(
        range,
        container,
        normalizedContainer
      )
      if (mappedOffsets) {
        start = mappedOffsets.start
        end = mappedOffsets.end
      }
    } catch (error) {
      console.warn('Range mapping failed, falling back to text search:', error)
    }

    // Fallback: Try enhanced text matching
    if (start < 0 || end < 0) {
      const trimmedText = textRaw.trim()

      // Use enhanced text matching which handles cross-element selections better
      const enhancedMatch = findBestTextMatch(visibleText, trimmedText)
      if (enhancedMatch) {
        start = enhancedMatch.start
        end = enhancedMatch.end
        textForHighlight = enhancedMatch.text // Update local variable only
      }
    }

    // Final fallback: try with original container
    if (start < 0 || end < 0) {
      console.warn(
        'Using final fallback offset calculation with original container'
      )
      const originalText = getVisiblePlainText(container)
      const trimmedText = textRaw.trim()
      const originalDirectIndex = originalText.indexOf(trimmedText)
      if (originalDirectIndex >= 0) {
        // Need to adjust offsets to normalized text
        start = Math.min(
          originalDirectIndex,
          visibleText.length - trimmedText.length
        )
        end = Math.min(start + trimmedText.length, visibleText.length)
      }
    }

    // Ensure we have valid positions
    if (start < 0) start = 0
    if (end < 0) end = start + textForHighlight.length

    const boundedStart = Math.max(0, Math.min(start, visibleText.length))
    const boundedEnd = Math.max(boundedStart, Math.min(end, visibleText.length))

    // Use the final text from normalized content or fallback to original
    const finalText =
      visibleText.slice(boundedStart, boundedEnd) || textForHighlight

    return { start: boundedStart, end: boundedEnd, textForHighlight: finalText }
  } finally {
    normalizedContainer.remove()
  }
}

// NEW: Map range from original container to normalized container
function mapRangeToNormalizedContainer(
  originalRange: Range,
  originalContainer: Element,
  normalizedContainer: Element
): { start: number; end: number } | null {
  try {
    // Get all text nodes in both containers
    const originalWalker = getTextWalker(originalContainer)
    const normalizedWalker = getTextWalker(normalizedContainer)

    // Build mapping between original and normalized text positions
    let originalOffset = 0
    let normalizedOffset = 0
    let startMapped = -1
    let endMapped = -1

    const originalNodes: {
      node: Text
      startOffset: number
      endOffset: number
    }[] = []
    const normalizedNodes: {
      node: Text
      startOffset: number
      endOffset: number
    }[] = []

    // Collect all text nodes with their offsets in original container
    while (originalWalker.nextNode()) {
      const textNode = originalWalker.currentNode as Text
      const nodeLength = textNode.data.length
      originalNodes.push({
        node: textNode,
        startOffset: originalOffset,
        endOffset: originalOffset + nodeLength,
      })
      originalOffset += nodeLength
    }

    // Collect all text nodes with their offsets in normalized container
    while (normalizedWalker.nextNode()) {
      const textNode = normalizedWalker.currentNode as Text
      const nodeLength = textNode.data.length
      normalizedNodes.push({
        node: textNode,
        startOffset: normalizedOffset,
        endOffset: normalizedOffset + nodeLength,
      })
      normalizedOffset += nodeLength
    }

    // Find where the original range starts and ends
    let rangeStartGlobalOffset = -1
    let rangeEndGlobalOffset = -1

    // Calculate global offset for range start
    for (const nodeInfo of originalNodes) {
      if (nodeInfo.node === originalRange.startContainer) {
        rangeStartGlobalOffset =
          nodeInfo.startOffset + originalRange.startOffset
        break
      }
    }

    // Calculate global offset for range end
    for (const nodeInfo of originalNodes) {
      if (nodeInfo.node === originalRange.endContainer) {
        rangeEndGlobalOffset = nodeInfo.startOffset + originalRange.endOffset
        break
      }
    }

    if (rangeStartGlobalOffset >= 0 && rangeEndGlobalOffset >= 0) {
      // Map these global offsets to normalized container
      // For now, use simple proportional mapping
      const originalTotalLength = originalOffset
      const normalizedTotalLength = normalizedOffset

      if (originalTotalLength > 0 && normalizedTotalLength > 0) {
        const ratio = normalizedTotalLength / originalTotalLength
        startMapped = Math.floor(rangeStartGlobalOffset * ratio)
        endMapped = Math.floor(rangeEndGlobalOffset * ratio)

        // Ensure valid bounds
        startMapped = Math.max(0, Math.min(startMapped, normalizedTotalLength))
        endMapped = Math.max(
          startMapped,
          Math.min(endMapped, normalizedTotalLength)
        )

        return { start: startMapped, end: endMapped }
      }
    }

    return null
  } catch (error) {
    console.warn('Range mapping failed:', error)
    return null
  }
}

// Helper function to create a normalized container for selection offset calculation
function createNormalizedContainerForSelection(
  originalContainer: Element
): HTMLDivElement {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = originalContainer.innerHTML

  // Apply same normalization as HighlightedTextRenderer
  tempDiv.style.position = 'absolute'
  tempDiv.style.left = '-9999px'
  tempDiv.style.top = '-9999px'
  tempDiv.style.pointerEvents = 'none'
  tempDiv.style.opacity = '0'
  tempDiv.style.zIndex = '-1'

  document.body.appendChild(tempDiv)

  // Apply same sanitization as HighlightedTextRenderer
  sanitizeHtmlContainer(tempDiv)

  return tempDiv
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
      const textRaw = selection.toString()

      // Check for empty or whitespace-only selection
      if (!textRaw || textRaw.trim().length === 0) {
        // Only hide if we don't have sticky selection
        if (!isStickyRef.current && !selectedText) {
          scheduleHide(1500)
        }
        return
      }

      if (!containerRef.current.contains(range.commonAncestorContainer)) {
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

      // Validate that the range is within our container
      if (!containerElement.contains(range.commonAncestorContainer)) {
        console.warn('Selection range is outside target container')
        return
      }

      try {
        const { start, end, textForHighlight } = computeOffsetsWithoutTrim(
          containerElement,
          range,
          textRaw
        )

        // Additional validation
        if (start < 0 || end <= start || textForHighlight.trim().length === 0) {
          console.warn('Invalid selection offsets calculated:', {
            start,
            end,
            textForHighlight,
          })
          return
        }

        // Debug logging (can be enabled for troubleshooting)
        if (process.env.NODE_ENV === 'development') {
          console.log('Selection processed in FloatingHighlightButton:', {
            selectedText: textForHighlight,
            selectedLength: textForHighlight.length,
            calculatedStart: start,
            calculatedEnd: end,
          })
        }

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
          if (
            rect.bottom - containerRect.top + buttonHeight + minimalOffset <=
            containerHeight
          ) {
            buttonY = rect.bottom - containerRect.top + minimalOffset
          } else if (
            rect.top - containerRect.top - buttonHeight - minimalOffset >=
            0
          ) {
            buttonY =
              rect.top - containerRect.top - buttonHeight - minimalOffset
          } else {
            // For extremely tight single-line cases, position the buttons to overlay slightly
            // This ensures they're always visible even if space is very limited
            const selectionMiddleY =
              rect.top + rect.height / 2 - containerRect.top
            if (
              selectionMiddleY - buttonHeight / 2 >= 0 &&
              selectionMiddleY + buttonHeight / 2 <= containerHeight
            ) {
              // Center vertically on the selection
              buttonY = selectionMiddleY - buttonHeight / 2
            } else {
              // Final fallback: position at the edge with the most space
              buttonY =
                spaceBelow > spaceAbove
                  ? Math.max(0, containerHeight - buttonHeight)
                  : 0
            }
          }
        }

        // Final boundary enforcement with more generous margins for single-line cases
        buttonX = Math.max(
          minDistance,
          Math.min(buttonX, containerWidth - buttonWidth - minDistance)
        )
        buttonY = Math.max(
          minDistance,
          Math.min(buttonY, containerHeight - buttonHeight - minDistance)
        )

        setPosition({
          x: buttonX,
          y: buttonY,
        })

        setSelectedText(textForHighlight)
        setSelectionRange({ start, end })
        setIsVisible(true)
      } catch (error) {
        console.error('Error processing text selection:', error)
        // Reset state on error
        isStickyRef.current = false
        storedRangeRef.current = null
      }
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
  }, [containerRef])

  const clearSelectionAndUI = () => {
    // Clear all state and reset for new selections
    storedRangeRef.current = null
    isStickyRef.current = false
    setSelectedText('')
    setSelectionRange(null)
    setIsVisible(false)

    // Clear any pending hide timeouts
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }

    // Clear the selection after a short delay to prevent immediate re-trigger
    setTimeout(() => {
      if (!isRestoringRef.current) {
        window.getSelection()?.removeAllRanges()
      }
    }, 100)
  }

  const handleHighlight = () => {
    if (selectionRange && selectedText) {
      onHighlight({
        start: selectionRange.start,
        end: selectionRange.end,
        text: selectedText,
      })

      // Clear UI immediately but allow for new selections after DOM update
      clearSelectionAndUI()

      // Force re-initialization after highlight is applied and DOM is updated
      setTimeout(() => {
        // Reset all internal state to allow fresh selections
        isStickyRef.current = false
        isRestoringRef.current = false
        storedRangeRef.current = null
      }, 200)
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
      const result = await autoAddToVocab(cleanText, examTitle, examId)

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
      setTimeout(() => {
        isRestoringRef.current = false
      }, 0)
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
