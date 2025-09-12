'use client'

import { useState, useEffect, useRef } from 'react'
import { Highlighter } from 'lucide-react'

interface Highlight {
  start: number
  end: number
  text: string
}

interface FloatingHighlightButtonProps {
  containerRef: React.RefObject<HTMLElement>
  onHighlight: (highlight: Highlight) => void
}

export default function FloatingHighlightButton({
  containerRef,
  onHighlight,
}: FloatingHighlightButtonProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState<{
    start: number
    end: number
  } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isHoveringRef = useRef(false)

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

      // Simple and natural positioning algorithm
      const buttonWidth = 40
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
    <button
      ref={buttonRef}
      onClick={handleHighlight}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="absolute z-50 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 p-2 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-110"
      style={{
        left: position.x,
        top: position.y,
      }}
      title="Highlight selected text"
    >
      <Highlighter size={16} />
    </button>
  )
}
