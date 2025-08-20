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

export default function FloatingHighlightButton({ containerRef, onHighlight }: FloatingHighlightButtonProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [selectedText, setSelectedText] = useState('')
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      
      if (!selection || !containerRef.current || selection.rangeCount === 0) {
        setIsVisible(false)
        return
      }

      const range = selection.getRangeAt(0)
      const text = selection.toString().trim()
      
      if (!text || !containerRef.current.contains(range.commonAncestorContainer)) {
        setIsVisible(false)
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
      
      // Position button at the end of selection, slightly offset
      setPosition({
        x: rect.right - containerRect.left + 5,
        y: rect.bottom - containerRect.top + 5
      })
      
      setSelectedText(text)
      setSelectionRange({ start, end })
      setIsVisible(true)
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsVisible(false)
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mousedown', handleClickOutside)
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [containerRef])

  const handleHighlight = () => {
    if (selectionRange && selectedText) {
      onHighlight({
        start: selectionRange.start,
        end: selectionRange.end,
        text: selectedText
      })
      
      // Clear selection and hide button
      window.getSelection()?.removeAllRanges()
      setIsVisible(false)
    }
  }

  if (!isVisible || !containerRef.current) return null

  return (
    <button
      ref={buttonRef}
      onClick={handleHighlight}
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