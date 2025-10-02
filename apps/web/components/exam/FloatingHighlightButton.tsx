'use client'

import { useEffect } from 'react'
import {
  Highlight,
  getVisiblePlainText,
  getTextOffsetInContainer,
  createNormalizedContainer,
  findBestTextMatch,
} from './text-utils'

interface FloatingHighlightButtonProps {
  containerRef: React.RefObject<HTMLElement>
  onHighlight: (highlight: Highlight) => void
  isHighlightMode: boolean
  isHtml?: boolean
}

export default function FloatingHighlightButton({
  containerRef,
  onHighlight,
  isHighlightMode,
  isHtml = false,
}: FloatingHighlightButtonProps) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const doc = container.ownerDocument || document

    const clearSelection = () => {
      const selection = doc.getSelection?.()
      selection?.removeAllRanges()
    }

    const handleMouseUp = () => {
      if (!isHighlightMode) return

      const selection = doc.getSelection?.()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return
      }

      const range = selection.getRangeAt(0)

      const startContainer = range.startContainer
      const endContainer = range.endContainer

      if (
        !container.contains(startContainer) ||
        !container.contains(endContainer)
      ) {
        clearSelection()
        return
      }

      let normalizedContainer: HTMLElement | null = null

      try {
        const rawSelection = range.toString()
        const trimmedSelection = rawSelection.trim()

        if (!trimmedSelection) {
          clearSelection()
          return
        }

        const domPlainText = getVisiblePlainText(container)

        const startOffsetDom = getTextOffsetInContainer(
          container,
          startContainer,
          range.startOffset
        )
        const endOffsetDom = getTextOffsetInContainer(
          container,
          endContainer,
          range.endOffset
        )

        const domStart = Math.max(0, Math.min(startOffsetDom, endOffsetDom))

        let plainText = domPlainText

        if (isHtml) {
          const normalized = createNormalizedContainer(container.innerHTML)
          normalizedContainer = normalized.container
          plainText = normalized.plainText
        }

        if (!plainText.trim()) {
          clearSelection()
          return
        }

        const ratio = domPlainText.length > 0
          ? domStart / domPlainText.length
          : 0
        const clampedRatio = Math.min(Math.max(ratio, 0), 1)
        const approxNormalizedStart = Math.floor(clampedRatio * plainText.length)

        const windowRadius = Math.max(
          80,
          Math.min(400, Math.max(trimmedSelection.length * 4, 120))
        )

        const beforeContext = plainText.slice(
          Math.max(0, approxNormalizedStart - windowRadius),
          approxNormalizedStart
        )
        const afterContext = plainText.slice(
          approxNormalizedStart,
          Math.min(plainText.length, approxNormalizedStart + windowRadius)
        )

        let match = findBestTextMatch(plainText, rawSelection, {
          before: beforeContext,
          after: afterContext,
        })

        if (!match) {
          match = findBestTextMatch(plainText, trimmedSelection, {
            before: beforeContext,
            after: afterContext,
          })
        }

        if (!match) {
          const directIndex = plainText.indexOf(trimmedSelection)
          if (directIndex >= 0) {
            match = {
              start: directIndex,
              end: directIndex + trimmedSelection.length,
              text: trimmedSelection,
            }
          }
        }

        if (!match) {
          clearSelection()
          return
        }

        const safeStart = Math.max(0, Math.min(match.start, plainText.length))
        const safeEnd = Math.max(safeStart, Math.min(match.end, plainText.length))
        const highlightText = plainText.slice(safeStart, safeEnd)
        if (!highlightText.trim()) {
          clearSelection()
          return
        }

        onHighlight({
          start: safeStart,
          end: safeEnd,
          text: highlightText,
        })
      } finally {
        normalizedContainer?.remove()
        clearSelection()
      }
    }

    doc.addEventListener('mouseup', handleMouseUp)

    return () => {
      doc.removeEventListener('mouseup', handleMouseUp)
    }
  }, [containerRef, isHighlightMode, onHighlight])

  useEffect(() => {
    if (!isHighlightMode) {
      const selection = document.getSelection?.()
      selection?.removeAllRanges()
    }
  }, [isHighlightMode])

  return null
}
