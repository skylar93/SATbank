'use client'

import { useEffect, useRef } from 'react'
import {
  Highlight,
  getVisiblePlainText,
  getTextOffsetInContainer,
  createNormalizedContainer,
  getTextWalker,
} from './text-utils'

const getCaretRangeFromPoint = (
  doc: Document,
  x: number,
  y: number
): Range | null => {
  const anyDoc = doc as any
  if (typeof anyDoc.caretRangeFromPoint === 'function') {
    return anyDoc.caretRangeFromPoint(x, y)
  }

  if (typeof anyDoc.caretPositionFromPoint === 'function') {
    const pos = anyDoc.caretPositionFromPoint(x, y)
    if (!pos) return null
    const range = doc.createRange()
    range.setStart(pos.offsetNode, pos.offset)
    range.collapse(true)
    return range
  }

  return null
}

const buildWhitespaceAwareMap = (
  domText: string,
  normalizedText: string
): number[] => {
  const map: number[] = new Array(domText.length + 1).fill(normalizedText.length)
  let domIdx = 0
  let normIdx = 0

  while (domIdx <= domText.length) {
    map[domIdx] = Math.min(normIdx, normalizedText.length)
    if (domIdx === domText.length) break

    const domChar = domText[domIdx]
    const normChar = normalizedText[normIdx]

    const domIsWhitespace = /\s/.test(domChar)
    const normIsWhitespace = normChar !== undefined ? /\s/.test(normChar) : false

    if (domChar === normChar) {
      domIdx += 1
      normIdx = Math.min(normIdx + 1, normalizedText.length)
      continue
    }

    if (domIsWhitespace && normIsWhitespace) {
      while (domIdx < domText.length && /\s/.test(domText[domIdx])) {
        map[domIdx] = Math.min(normIdx, normalizedText.length)
        domIdx += 1
      }
      while (normIdx < normalizedText.length && /\s/.test(normalizedText[normIdx])) {
        normIdx += 1
      }
      continue
    }

    if (domIsWhitespace && !normIsWhitespace) {
      domIdx += 1
      continue
    }

    if (!domIsWhitespace && normIsWhitespace) {
      normIdx += 1
      continue
    }

    domIdx += 1
    if (normIdx < normalizedText.length) normIdx += 1
  }

  return map
}

const resolveDomPosition = (
  container: Element,
  offset: number
): { node: Text; offset: number } | null => {
  const walker = getTextWalker(container)
  let remaining = offset

  let lastText: Text | null = null
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const length = node.data.length
    lastText = node
    if (remaining <= length) {
      return { node, offset: Math.max(0, Math.min(remaining, length)) }
    }
    remaining -= length
  }

  if (lastText) {
    return { node: lastText, offset: lastText.data.length }
  }

  return null
}

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
  const pointerStartDomRef = useRef<number | null>(null)
  const highlightModeRef = useRef(isHighlightMode)

  useEffect(() => {
    highlightModeRef.current = isHighlightMode
  }, [isHighlightMode])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const doc = container.ownerDocument || document

    pointerStartDomRef.current = null

    if (!highlightModeRef.current) {
      return
    }

    const clearSelection = () => {
      const selection = doc.getSelection?.()
      selection?.removeAllRanges()
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!highlightModeRef.current) return
      if (!container.contains(event.target as Node)) return

      const caretRange = getCaretRangeFromPoint(
        doc,
        event.clientX,
        event.clientY
      )

      if (!caretRange) return

      const offsetDom = getTextOffsetInContainer(
        container,
        caretRange.startContainer,
        caretRange.startOffset
      )

      pointerStartDomRef.current = offsetDom

      const selection = doc.getSelection?.()
      if (selection) {
        try {
          selection.removeAllRanges()
          selection.addRange(caretRange)
        } catch {}
      }
    }

    const handleMouseUp = () => {
      if (!highlightModeRef.current) return

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
        pointerStartDomRef.current = null
        return
      }

      let normalizedContainer: HTMLElement | null = null

      try {
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
        const focusOffsetDom = selection.focusNode
          ? getTextOffsetInContainer(
              container,
              selection.focusNode,
              selection.focusOffset ?? range.endOffset
            )
          : endOffsetDom

        const anchorDom = pointerStartDomRef.current ?? startOffsetDom
        const focusDom = Number.isFinite(focusOffsetDom)
          ? focusOffsetDom
          : endOffsetDom

        let domStart = Math.max(0, Math.min(anchorDom, focusDom))
        let domEnd = Math.max(domStart, Math.max(anchorDom, focusDom))

        let plainText = domPlainText

        if (isHtml) {
          const normalized = createNormalizedContainer(container.innerHTML)
          normalizedContainer = normalized.container
          plainText = normalized.plainText
        }

        if (!plainText.trim()) {
          clearSelection()
          pointerStartDomRef.current = null
          return
        }

        const domToNormalized = buildWhitespaceAwareMap(domPlainText, plainText)
        const mappedStart =
          domToNormalized[Math.min(domStart, domToNormalized.length - 1)] ?? 0
        const mappedEnd =
          domToNormalized[Math.min(domEnd, domToNormalized.length - 1)] ??
          mappedStart

        const safeStart = Math.max(0, Math.min(mappedStart, plainText.length))
        const safeEnd = Math.max(safeStart, Math.min(mappedEnd, plainText.length))

        const rawSlice = plainText.slice(safeStart, safeEnd)
        if (!rawSlice.trim()) {
          clearSelection()
          pointerStartDomRef.current = null
          return
        }

        const leadingTrim = rawSlice.length - rawSlice.trimStart().length
        const trailingTrim = rawSlice.length - rawSlice.trimEnd().length

        const finalStart = safeStart + leadingTrim
        const finalEnd = safeEnd - trailingTrim

        if (finalEnd <= finalStart) {
          clearSelection()
          pointerStartDomRef.current = null
          return
        }

        const highlightText = plainText.slice(finalStart, finalEnd)
        if (!highlightText.trim()) {
          clearSelection()
          pointerStartDomRef.current = null
          return
        }

        onHighlight({
          start: finalStart,
          end: finalEnd,
          text: highlightText,
        })
      } finally {
        normalizedContainer?.remove()
        clearSelection()
        pointerStartDomRef.current = null
      }
    }

    container.addEventListener('pointerdown', handlePointerDown)
    doc.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown)
      doc.removeEventListener('mouseup', handleMouseUp)
      pointerStartDomRef.current = null
    }
  }, [containerRef, isHighlightMode, onHighlight, isHtml])

  useEffect(() => {
    if (!highlightModeRef.current) {
      const selection = document.getSelection?.()
      selection?.removeAllRanges()
      pointerStartDomRef.current = null
    }
  }, [isHighlightMode])

  return null
}
