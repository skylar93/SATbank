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

        const rawHighlightText = plainText.slice(safeStart, safeEnd)
        const leadingTrim = rawHighlightText.length -
          rawHighlightText.trimStart().length
        const trailingTrim = rawHighlightText.length -
          rawHighlightText.trimEnd().length

        const finalStart = safeStart + leadingTrim
        const finalEnd = safeEnd - trailingTrim

        if (finalEnd <= finalStart) {
          clearSelection()
          return
        }

        const selectionSlice = plainText.slice(finalStart, finalEnd)
        if (!selectionSlice.trim()) {
          clearSelection()
          return
        }

        const segments: Array<{
          start: number
          end: number
          indented: boolean
        }> = []
        const walker = doc.createTreeWalker(
          container,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode(node) {
              if (!(node instanceof Text)) return NodeFilter.FILTER_REJECT
              return node.nodeValue && node.nodeValue.trim().length > 0
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_SKIP
            },
          }
        )

        while (walker.nextNode()) {
          const textNode = walker.currentNode as Text
          if (!range.intersectsNode(textNode)) continue

          const nodeText = textNode.data
          if (!nodeText.trim()) continue

          const nodeGlobalStart = getTextOffsetInContainer(
            container,
            textNode,
            0
          )
          const nodeGlobalEnd = nodeGlobalStart + nodeText.length

          const overlapStart = Math.max(nodeGlobalStart, finalStart)
          const overlapEnd = Math.min(nodeGlobalEnd, finalEnd)

          if (overlapEnd <= overlapStart) continue

          const overlapText = plainText.slice(overlapStart, overlapEnd)
          if (!overlapText.trim()) continue

          const overlapLeading = overlapText.length - overlapText.trimStart().length
          const overlapTrailing = overlapText.length - overlapText.trimEnd().length

          const chunkStart = overlapStart + overlapLeading
          const chunkEnd = overlapEnd - overlapTrailing

          if (chunkEnd <= chunkStart) continue

          const chunkText = plainText.slice(chunkStart, chunkEnd)
          if (!chunkText.trim()) continue

          segments.push({
            start: chunkStart,
            end: chunkEnd,
            indented: overlapLeading > 0,
          })
        }

        if (segments.length === 0) {
          clearSelection()
          return
        }

        let candidateSegments = segments
        const indentedSegments = segments.filter((seg) => seg.indented)
        if (indentedSegments.length > 0 && indentedSegments.length < segments.length) {
          candidateSegments = indentedSegments
        }

        const highlightStart = candidateSegments.reduce(
          (acc, seg) => Math.min(acc, seg.start),
          candidateSegments[0].start
        )
        const highlightEnd = candidateSegments.reduce(
          (acc, seg) => Math.max(acc, seg.end),
          candidateSegments[0].end
        )

        if (highlightEnd <= highlightStart) {
          clearSelection()
          return
        }

        const highlightText = plainText.slice(highlightStart, highlightEnd)
        if (!highlightText.trim()) {
          clearSelection()
          return
        }

        onHighlight({
          start: highlightStart,
          end: highlightEnd,
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
