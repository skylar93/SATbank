'use client'

import { useEffect, useRef } from 'react'
import {
  Highlight,
  getVisiblePlainText,
  getTextOffsetInContainer,
  createNormalizedContainer,
  findBestTextMatch,
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
  const isAdjustingSelectionRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const doc = container.ownerDocument || document

    const clearSelection = () => {
      const selection = doc.getSelection?.()
      selection?.removeAllRanges()
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!isHighlightMode) {
        pointerStartDomRef.current = null
        return
      }

      if (!container.contains(event.target as Node)) {
        pointerStartDomRef.current = null
        return
      }

      const caretRange = getCaretRangeFromPoint(
        doc,
        event.clientX,
        event.clientY
      )

      if (!caretRange) {
        pointerStartDomRef.current = null
        return
      }

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
        const focusOffsetDom = selection.focusNode
          ? getTextOffsetInContainer(
              container,
              selection.focusNode,
              selection.focusOffset
            )
          : endOffsetDom

        let domStart = Math.max(0, Math.min(startOffsetDom, endOffsetDom))
        let domEnd = Math.max(domStart, Math.max(startOffsetDom, endOffsetDom))

        if (
          pointerStartDomRef.current !== null &&
          Number.isFinite(pointerStartDomRef.current)
        ) {
          const pointerDom = Math.max(0, pointerStartDomRef.current)
          const focusDom = Math.max(0, focusOffsetDom)
          domStart = Math.min(pointerDom, focusDom)
          domEnd = Math.max(pointerDom, focusDom)
        }

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

        const domToNormalized = buildWhitespaceAwareMap(domPlainText, plainText)
        const mappedStart = domToNormalized[Math.min(domStart, domToNormalized.length - 1)] ?? 0
        const mappedEnd = domToNormalized[Math.min(domEnd, domToNormalized.length - 1)] ?? mappedStart

        const ratio = domPlainText.length > 0
          ? domStart / domPlainText.length
          : 0
        const clampedRatio = Math.min(Math.max(ratio, 0), 1)
        const approxNormalizedStart = Math.floor(clampedRatio * plainText.length)

        const windowRadius = Math.max(
          80,
          Math.min(400, Math.max(trimmedSelection.length * 4, 120))
        )

        const windowStart = Math.max(0, approxNormalizedStart - windowRadius)
        const windowEnd = Math.min(plainText.length, approxNormalizedStart + windowRadius)
        const windowText = plainText.slice(windowStart, windowEnd)

        const domSelectionSlice = domPlainText.slice(domStart, domEnd)
        const normalizedDomSlice = domSelectionSlice.replace(/\s+/g, ' ').trim()
        const initialSlice = plainText.slice(mappedStart, mappedEnd)

        const variations = Array.from(
          new Set(
            [
              rawSelection,
              trimmedSelection,
              rawSelection.replace(/\s+/g, ' ').trim(),
              trimmedSelection.replace(/\s+/g, ' '),
              domSelectionSlice,
              domSelectionSlice.trim(),
              normalizedDomSlice,
              initialSlice,
              initialSlice.trim(),
            ].filter(Boolean)
          )
        )

        const findNearestIndex = (
          source: string,
          target: string,
          preferredStart: number
        ): number => {
          let idx = source.indexOf(target)
          if (idx < 0) return -1
          let best = idx
          let bestDistance = Math.abs(idx - preferredStart)
          while (true) {
            idx = source.indexOf(target, idx + 1)
            if (idx < 0) break
            const distance = Math.abs(idx - preferredStart)
            if (distance < bestDistance) {
              bestDistance = distance
              best = idx
            }
          }
          return best
        }

        const tryWindowMatch = (): { start: number; end: number; text: string } | null => {
          for (const variant of variations) {
            const idx = findNearestIndex(
              windowText,
              variant,
              approxNormalizedStart - windowStart
            )
            if (idx >= 0) {
              const start = windowStart + idx
              return { start, end: start + variant.length, text: variant }
            }
          }
          return null
        }

        let match: { start: number; end: number; text: string } | null = null

        if (initialSlice.trim()) {
          match = {
            start: mappedStart,
            end: Math.max(mappedStart, mappedEnd),
            text: initialSlice,
          }
        }

        if (!match) {
          match = tryWindowMatch()
        }

        if (!match) {
          const beforeContext = plainText.slice(windowStart, approxNormalizedStart)
          const afterContext = plainText.slice(
            approxNormalizedStart,
            windowEnd
          )

          match = findBestTextMatch(plainText, rawSelection, {
            before: beforeContext,
            after: afterContext,
          })

          if (!match) {
            match = findBestTextMatch(plainText, trimmedSelection, {
              before: beforeContext,
              after: afterContext,
            })
          }
        }

        if (!match) {
          for (const variant of variations) {
            const directIndex = findNearestIndex(
              plainText,
              variant,
              approxNormalizedStart
            )
            if (directIndex >= 0) {
              match = {
                start: directIndex,
                end: directIndex + variant.length,
                text: variant,
              }
              break
            }
          }
        }

        if (!match) {
          clearSelection()
          return
        }

        const safeStart = Math.max(0, Math.min(match.start, plainText.length))
        const safeEnd = Math.max(safeStart, Math.min(match.end, plainText.length))

        const rawSlice = plainText.slice(safeStart, safeEnd)
        if (!rawSlice.trim()) {
          clearSelection()
          return
        }

        const trimmedLeading = rawSlice.length - rawSlice.trimStart().length
        const trimmedTrailing = rawSlice.length - rawSlice.trimEnd().length

        const finalStart = safeStart + trimmedLeading
        const finalEnd = safeEnd - trimmedTrailing

        if (finalEnd <= finalStart) {
          clearSelection()
          return
        }

        const highlightText = plainText.slice(finalStart, finalEnd)
        if (!highlightText.trim()) {
          clearSelection()
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
    container.addEventListener('pointermove', handlePointerMove)
    doc.addEventListener('mouseup', handleMouseUp)

    const handleSelectionChange = () => {
      if (!isHighlightMode) return
      if (isAdjustingSelectionRef.current) return
      if (pointerStartDomRef.current === null) return
      if (!pointerHasMovedRef.current) return

      if (scheduledAdjustmentRef.current !== null) {
        cancelAnimationFrame(scheduledAdjustmentRef.current)
      }

      scheduledAdjustmentRef.current = requestAnimationFrame(() => {
        scheduledAdjustmentRef.current = null

        const selection = doc.getSelection?.()
        if (!selection || selection.rangeCount === 0) return

        const range = selection.getRangeAt(0)
        const focusNode = selection.focusNode ?? range.endContainer
        const focusOffset = selection.focusNode
          ? selection.focusOffset ?? range.endOffset
          : range.endOffset

        if (!container.contains(focusNode)) return

        const focusDomOffset = getTextOffsetInContainer(
          container,
          focusNode,
          focusOffset
        )

        const anchorDom = Math.max(0, pointerStartDomRef.current!)
        const focusDom = Math.max(0, focusDomOffset)

        if (anchorDom === focusDom) return

        const startOffset = Math.min(anchorDom, focusDom)
        const endOffset = Math.max(anchorDom, focusDom)

        const startPos = resolveDomPosition(container, startOffset)
        const endPos = resolveDomPosition(container, endOffset)

        if (!startPos || !endPos) return

        isAdjustingSelectionRef.current = true
        try {
          const newRange = doc.createRange()
          newRange.setStart(startPos.node, startPos.offset)
          newRange.setEnd(endPos.node, endPos.offset)
          selection.removeAllRanges()
          selection.addRange(newRange)
        } finally {
          isAdjustingSelectionRef.current = false
        }
      })
    }

    doc.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      doc.removeEventListener('mouseup', handleMouseUp)
      doc.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [containerRef, isHighlightMode, onHighlight, isHtml])

  useEffect(() => {
    if (!isHighlightMode) {
      const selection = document.getSelection?.()
      selection?.removeAllRanges()
      pointerStartDomRef.current = null
      isAdjustingSelectionRef.current = false
      pointerHasMovedRef.current = false
      if (scheduledAdjustmentRef.current !== null) {
        cancelAnimationFrame(scheduledAdjustmentRef.current)
        scheduledAdjustmentRef.current = null
      }
    }
  }, [isHighlightMode])

  return null
}
