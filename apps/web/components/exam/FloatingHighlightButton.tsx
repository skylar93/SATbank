'use client'

import { useState, useEffect, useRef } from 'react'
import { Highlighter, Languages } from 'lucide-react'
import { autoAddToVocab } from '@/lib/dictionary-actions'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import {
  Highlight,
  getVisiblePlainText,
  createNormalizedContainer,
  sanitizeHtmlContainer,
  findBestTextMatch,
} from './text-utils'

interface FloatingHighlightButtonProps {
  containerRef: React.RefObject<HTMLElement>
  onHighlight: (highlight: Highlight) => void
  examTitle?: string
  examId?: string
  isHtml?: boolean
  originalText?: string
  isHighlightMode: boolean // NEW: Highlight mode toggle
}

export default function FloatingHighlightButton({
  containerRef,
  onHighlight,
  examTitle,
  examId,
  isHtml = false,
  originalText = '',
  isHighlightMode,
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
  const isProcessingRef = useRef(false)

  // Clear state when highlight mode changes or content changes
  useEffect(() => {
    clearSelectionAndUI()
  }, [isHighlightMode, originalText, containerRef])

  // Function to compute text offsets for highlighting
  const computeTextOffsets = (
    container: Element,
    range: Range,
    textRaw: string
  ): { start: number; end: number; textForHighlight: string } => {
    if (isHtml && originalText) {
      // For HTML content, use normalized container approach
      const { container: tempContainer, plainText } = createNormalizedContainer(
        originalText || container.innerHTML
      )

      try {
        const containerPlainText = getVisiblePlainText(container)
        const rangeText = range.toString().trim()

        // Find the text in normalized content
        const match = findBestTextMatch(plainText, rangeText)
        if (match) {
          return {
            start: match.start,
            end: match.end,
            textForHighlight: match.text,
          }
        }

        // Fallback: simple text search
        const directIndex = plainText.indexOf(rangeText)
        if (directIndex >= 0) {
          return {
            start: directIndex,
            end: directIndex + rangeText.length,
            textForHighlight: rangeText,
          }
        }

        throw new Error('Could not find text in normalized content')
      } finally {
        tempContainer.remove()
      }
    } else {
      // For plain text content
      const containerText = getVisiblePlainText(container)
      const rangeText = range.toString().trim()

      const directIndex = containerText.indexOf(rangeText)
      if (directIndex >= 0) {
        return {
          start: directIndex,
          end: directIndex + rangeText.length,
          textForHighlight: rangeText,
        }
      }

      // Enhanced text matching for edge cases
      const match = findBestTextMatch(containerText, rangeText)
      if (match) {
        return {
          start: match.start,
          end: match.end,
          textForHighlight: match.text,
        }
      }

      throw new Error('Could not locate selected text in container')
    }
  }

  // Process text selection and show button
  const processSelection = (selection: Selection) => {
    if (!containerRef.current || !isHighlightMode || isProcessingRef.current) {
      return
    }

    const range = selection.getRangeAt(0)
    const textRaw = range.toString().trim()

    if (!textRaw || textRaw.length === 0) {
      clearSelectionAndUI()
      return
    }

    // Check if selection is within container
    const startWithinContainer = containerRef.current.contains(range.startContainer)
    const endWithinContainer = containerRef.current.contains(range.endContainer)

    if (!startWithinContainer || !endWithinContainer) {
      clearSelectionAndUI()
      return
    }

    try {
      isProcessingRef.current = true

      const { start, end, textForHighlight } = computeTextOffsets(
        containerRef.current,
        range,
        textRaw
      )

      if (start < 0 || end <= start || textForHighlight.trim().length === 0) {
        console.warn('Invalid selection offsets:', { start, end, textForHighlight })
        return
      }

      // Position the button near the selection
      const rect = range.getBoundingClientRect()
      const containerRect = containerRef.current.getBoundingClientRect()

      const buttonWidth = 120
      const buttonHeight = 44
      const offset = 8

      let buttonX = rect.left - containerRect.left + rect.width / 2 - buttonWidth / 2
      let buttonY = rect.top - containerRect.top - buttonHeight - offset

      // Keep button within container bounds
      buttonX = Math.max(offset, Math.min(buttonX, containerRect.width - buttonWidth - offset))

      if (buttonY < offset) {
        buttonY = rect.bottom - containerRect.top + offset
      }

      buttonY = Math.max(offset, Math.min(buttonY, containerRect.height - buttonHeight - offset))

      setPosition({ x: buttonX, y: buttonY })
      setSelectedText(textForHighlight)
      setSelectionRange({ start, end })
      setIsVisible(true)

      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
    } catch (error) {
      console.error('Error processing text selection:', error)
      toast.error('선택한 텍스트를 처리할 수 없었습니다. 다시 시도해 주세요.')
    } finally {
      isProcessingRef.current = false
    }
  }

  // Selection change handler
  useEffect(() => {
    const handleSelectionChange = () => {
      // Only process selections when highlight mode is active
      if (!isHighlightMode) {
        clearSelectionAndUI()
        return
      }

      const selection = window.getSelection()

      if (!selection || !containerRef.current || selection.rangeCount === 0) {
        scheduleHide(1500)
        return
      }

      if (selection.isCollapsed) {
        scheduleHide(1500)
        return
      }

      processSelection(selection)
    }

    const handleMouseUp = () => {
      // Small delay to allow selection to complete
      setTimeout(handleSelectionChange, 10)
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node

      // Don't hide if clicking on the button itself
      if (buttonRef.current && buttonRef.current.contains(target)) {
        return
      }

      const clickedInsideContainer =
        containerRef.current && containerRef.current.contains(target)

      if (!clickedInsideContainer) {
        clearSelectionAndUI()
      } else {
        scheduleHide(2000)
      }
    }

    // Only add listeners when highlight mode is active
    if (isHighlightMode) {
      document.addEventListener('selectionchange', handleSelectionChange)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousedown', handleClickOutside)
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [isHighlightMode, containerRef])

  const scheduleHide = (ms: number) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current) {
        setIsVisible(false)
      }
    }, ms)
  }

  const clearSelectionAndUI = () => {
    setSelectedText('')
    setSelectionRange(null)
    setIsVisible(false)

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }

    // Clear browser selection
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges()
    }
  }

  const handleHighlight = () => {
    if (selectionRange && selectedText) {
      onHighlight({
        start: selectionRange.start,
        end: selectionRange.end,
        text: selectedText,
      })

      clearSelectionAndUI()
      toast.success('하이라이트가 추가되었습니다')
    }
  }

  const handleAddToVocab = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다')
      return
    }

    if (!selectedText) return

    const cleanText = selectedText.trim()
    if (cleanText.length < 2 || cleanText.length > 50) {
      toast.error('2-50자 사이의 단어를 선택해 주세요')
      return
    }

    if (/^[^a-zA-Z]*$/.test(cleanText) || cleanText.split(' ').length > 3) {
      toast.error('유효한 단어나 짧은 구문을 선택해 주세요')
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
      toast.error('단어 추가에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setIsAddingVocab(false)
    }
  }

  const handleMouseEnter = () => {
    isHoveringRef.current = true
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }

  const handleMouseLeave = () => {
    isHoveringRef.current = false
    scheduleHide(2000)
  }

  // Only show button when highlight mode is active and we have a valid selection
  if (!isVisible || !containerRef.current || !isHighlightMode) return null

  return (
    <div
      ref={buttonRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="absolute z-50 flex space-x-2 transition-all duration-200 ease-in-out"
      style={{
        left: position.x,
        top: position.y,
        maxWidth: '140px',
        minHeight: '40px',
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
  )
}