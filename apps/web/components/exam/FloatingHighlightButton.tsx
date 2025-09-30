'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  Highlight,
  getVisiblePlainText,
  getTextOffsetInContainer,
} from './text-utils'

interface FloatingHighlightButtonProps {
  containerRef: React.RefObject<HTMLElement>
  onHighlight: (highlight: Highlight) => void
  isHighlightMode: boolean
}

interface PointerState {
  active: boolean
  pointerId: number | null
  startIndex: number | null
  lastIndex: number | null
  plainText: string
}

const INITIAL_POINTER_STATE: PointerState = {
  active: false,
  pointerId: null,
  startIndex: null,
  lastIndex: null,
  plainText: '',
}

function getCaretRangeFromPoint(
  doc: Document,
  x: number,
  y: number
): Range | null {
  if ((doc as any).caretRangeFromPoint) {
    return (doc as any).caretRangeFromPoint(x, y)
  }

  const caretPosition = (doc as any).caretPositionFromPoint?.(x, y)
  if (!caretPosition) return null

  const range = doc.createRange()
  range.setStart(caretPosition.offsetNode, caretPosition.offset)
  range.collapse(true)
  return range
}

export default function FloatingHighlightButton({
  containerRef,
  onHighlight,
  isHighlightMode,
}: FloatingHighlightButtonProps) {
  const pointerStateRef = useRef<PointerState>({ ...INITIAL_POINTER_STATE })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const doc = container.ownerDocument || document

    const resetPointerState = () => {
      pointerStateRef.current = { ...INITIAL_POINTER_STATE }
    }

    const getOffsetFromEvent = (event: PointerEvent): number | null => {
      const range = getCaretRangeFromPoint(doc, event.clientX, event.clientY)
      if (!range) return null

      const { startContainer, startOffset } = range
      if (!container.contains(startContainer)) {
        return null
      }

      return getTextOffsetInContainer(container, startContainer, startOffset)
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!isHighlightMode) return
      if (event.button !== 0) return
      if (!container.contains(event.target as Node)) return

      doc.getSelection?.()?.removeAllRanges()

      const offset = getOffsetFromEvent(event)
      if (offset === null) {
        return
      }

      pointerStateRef.current = {
        active: true,
        pointerId: event.pointerId,
        startIndex: offset,
        lastIndex: offset,
        plainText: getVisiblePlainText(container),
      }

      try {
        container.setPointerCapture?.(event.pointerId)
      } catch {}
    }

    const handlePointerMove = (event: PointerEvent) => {
      const state = pointerStateRef.current
      if (!state.active || state.pointerId !== event.pointerId) return

      const offset = getOffsetFromEvent(event)
      if (offset === null) return

      state.lastIndex = offset
    }

    const finalizeHighlight = (endIndex: number | null) => {
      const state = pointerStateRef.current
      if (!state.active || state.startIndex === null) return

      const finalEndIndex =
        endIndex !== null ? endIndex : state.lastIndex ?? state.startIndex

      const start = Math.min(state.startIndex, finalEndIndex)
      const end = Math.max(state.startIndex, finalEndIndex)

      if (end - start <= 0) {
        resetPointerState()
        return
      }

      const plainText = state.plainText || getVisiblePlainText(container)
      const selectedText = plainText.slice(start, end)

      if (!selectedText.trim()) {
        resetPointerState()
        return
      }

      doc.getSelection?.()?.removeAllRanges()

      onHighlight({
        start,
        end,
        text: selectedText,
      })

      toast.success('하이라이트가 추가되었어요.')
      resetPointerState()
    }

    const handlePointerUp = (event: PointerEvent) => {
      const state = pointerStateRef.current
      if (!state.active || state.pointerId !== event.pointerId) return

      try {
        container.releasePointerCapture?.(event.pointerId)
      } catch {}

      const offset = getOffsetFromEvent(event)
      finalizeHighlight(offset)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      const state = pointerStateRef.current
      if (!state.active || state.pointerId !== event.pointerId) return
      resetPointerState()
    }

    const addEventListeners = () => {
      container.addEventListener('pointerdown', handlePointerDown)
      container.addEventListener('pointermove', handlePointerMove)
      doc.addEventListener('pointerup', handlePointerUp)
      doc.addEventListener('pointercancel', handlePointerCancel)
    }

    const removeEventListeners = () => {
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      doc.removeEventListener('pointerup', handlePointerUp)
      doc.removeEventListener('pointercancel', handlePointerCancel)
    }

    if (isHighlightMode) {
      container.style.userSelect = 'none'
      container.style.cursor = 'text'
      addEventListeners()
    } else {
      container.style.userSelect = ''
      container.style.cursor = ''
      removeEventListeners()
      resetPointerState()
    }

    return () => {
      removeEventListeners()
      container.style.userSelect = ''
      container.style.cursor = ''
      resetPointerState()
    }
  }, [containerRef, isHighlightMode, onHighlight])

  return null
}
