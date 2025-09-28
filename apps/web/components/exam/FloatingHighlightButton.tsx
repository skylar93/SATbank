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
  createNormalizedContainer,
  getTextOffsetInContainer,
} from './text-utils'

function computeOffsetsWithoutTrim(
  container: Element,
  range: Range,
  textRaw: string,
  isHtml: boolean = false,
  originalTextContent: string = ''
) {
  // For HTML content, use DOM-based position calculation
  if (isHtml && originalTextContent) {
    let normalizedContainer: HTMLElement | null = null
    try {
      const preferredHtml = originalTextContent?.trim().length
        ? originalTextContent
        : ''

      let { container: tempContainer, plainText } = createNormalizedContainer(
        preferredHtml || container.innerHTML
      )

      if (
        preferredHtml &&
        domSelectedText.trim().length > 0 &&
        !plainText.includes(domSelectedText.trim())
      ) {
        // Fallback to actual rendered HTML when provided original content no longer matches
        tempContainer.remove()
        ;({ container: tempContainer, plainText } = createNormalizedContainer(
          container.innerHTML
        ))
      }
      normalizedContainer = tempContainer

      let domStart = 0
      let domEnd = 0
      let domSelectedText = range.toString() || textRaw || ''

      // Primary: compute offsets via walker-based node offsets (consistent with renderer)
      const startOffsetInDom = getTextOffsetInContainer(
        container,
        range.startContainer,
        range.startOffset
      )
      const endOffsetInDom = getTextOffsetInContainer(
        container,
        range.endContainer,
        range.endOffset
      )
      domStart = Math.max(0, Math.min(startOffsetInDom, endOffsetInDom))
      domEnd = Math.max(domStart, Math.max(startOffsetInDom, endOffsetInDom))

      const domPlainText = getVisiblePlainText(container)
      if (domEnd <= domStart) {
        domEnd = domStart + domSelectedText.length
      }
      const domSlice = domPlainText.slice(domStart, domEnd)
      domSelectedText = domSlice || domSelectedText || textRaw || ''
      const cleanDomSelected = domSelectedText.trim() || textRaw.trim()

      // Heuristic boundary: avoid spilling into question stems like
      // "As used in the text", "Which choice", etc.
      const boundaryPatterns = [
        /\bAs used in the text\b/i,
        /\bWhich choice\b/i,
        /\bWhich statement\b/i,
        /\bWhich of the following\b/i,
        /\bWhat is the value of\b/i,
        /\bBased on the passage\b/i,
      ]
      const findBoundary = (s: string) => {
        let idx = -1
        for (const re of boundaryPatterns) {
          const m = s.search(re)
          if (m >= 0) idx = idx === -1 ? m : Math.min(idx, m)
        }
        return idx
      }
      const domBoundary = findBoundary(domPlainText)
      if (domBoundary >= 0 && domStart < domBoundary && domEnd > domBoundary) {
        // Clamp selection end to stay within passage
        domEnd = domBoundary
      }

      const beforeContext = domPlainText.slice(Math.max(0, domStart - 80), domStart)
      const afterContext = domPlainText.slice(domEnd, domEnd + 80)

      const normalizeForComparison = (value: string) =>
        value
          ? value
              .replace(/\u00a0/g, ' ')
              .replace(/[“”]/g, '"')
              .replace(/[‘’]/g, "'")
              .replace(/\s+/g, ' ')
              .trim()
          : ''

      const targetNormalized = normalizeForComparison(domSelectedText)

      const generateCandidateVariations = (input: string): string[] => {
        if (!input) return []
        const variations = new Set<string>()
        const push = (value: string | null | undefined) => {
          if (!value) return
          const normalized = value
            .replace(/\u00a0/g, ' ')
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'")
          if (normalized.length) variations.add(normalized)
        }

        push(input)
        push(input.trim())
        push(input.replace(/\s+/g, ' '))
        push(input.replace(/\s+/g, ''))
        push(input.replace(/\s*\n\s*/g, ' '))
        push(input.replace(/\s*\n\s*/g, ''))
        push(input.replace(/\n+/g, ' '))
        push(input.replace(/\n+/g, ''))
        push(input.replace(/\s{2,}/g, ' '))
        push(input.replace(/\s{2,}/g, ''))
        push(input.replace(/\s+/g, ' ').trim())

        return Array.from(variations).filter(Boolean)
      }

      const ratioToNormalized =
        plainText.length > 0 && domPlainText.length > 0
          ? domStart / domPlainText.length
          : 0
      const clampedRatio = Math.min(Math.max(ratioToNormalized, 0), 1)
      const approxNormalizedStart = Math.floor(clampedRatio * plainText.length)
      const approxWindowRadius = Math.max(
        200,
        Math.min(
          600,
          (domSelectedText.length || cleanDomSelected.length || textRaw.length || 1) * 2
        )
      )
      let approxWindowStart = Math.max(0, approxNormalizedStart - approxWindowRadius)
      let approxWindowEnd = Math.min(plainText.length, approxNormalizedStart + approxWindowRadius)
      // Apply boundary to normalized window as well
      const normalizedBoundary = (() => {
        // Map domBoundary proportionally to normalized plainText space
        if (domBoundary >= 0 && domPlainText.length > 0) {
          return Math.floor((domBoundary / domPlainText.length) * plainText.length)
        }
        return -1
      })()
      if (normalizedBoundary >= 0) {
        approxWindowEnd = Math.min(approxWindowEnd, normalizedBoundary)
        if (approxWindowStart >= approxWindowEnd) {
          // Keep a small window ending at boundary
          approxWindowStart = Math.max(0, normalizedBoundary - approxWindowRadius)
        }
      }
      const approxWindowText = plainText.slice(approxWindowStart, approxWindowEnd)
      const positionTolerance = Math.max(
        80,
        Math.min(
          400,
          (domEnd - domStart || cleanDomSelected.length || textRaw.length || 20) * 3
        )
      )

      console.log('🎯 highlight window debug', {
        domStart,
        domEnd,
        domSelectedTextPreview: domSelectedText.slice(0, 120),
        domPlainTextAroundStart: domPlainText.slice(
          Math.max(0, domStart - 40),
          Math.min(domPlainText.length, domEnd + 40)
        ),
        approxNormalizedStart,
        approxWindowStart,
        approxWindowEnd,
        approxWindowSnippet: plainText.slice(
          approxWindowStart,
          Math.min(plainText.length, approxWindowStart + 160)
        ),
      })

      const logMatch = (
        label: string,
        start: number,
        end: number,
        snippetSource?: string | null
      ) => {
        const snippet =
          snippetSource ?? plainText.slice(Math.max(0, start), Math.max(0, end))
        console.log('✅ highlight match', {
          label,
          start,
          end,
          snippetPreview: snippet.slice(0, 160),
        })
        return {
          start: Math.max(0, Math.min(start, end)),
          end: Math.max(0, Math.max(start, end)),
          textForHighlight: snippet,
        }
      }

      const tryMatchInWindow = (targets: (string | null | undefined)[]) => {
        for (const target of targets) {
          if (!target) continue
          for (const variation of generateCandidateVariations(target)) {
            const directIndex = approxWindowText.indexOf(variation)
            if (directIndex >= 0) {
              const start = approxWindowStart + directIndex
              const end = start + variation.length
              const snippet = plainText.slice(start, end)
              if (normalizeForComparison(snippet) === targetNormalized) {
                return { start, end, text: snippet }
              }
            }

            const flexibleMatch = findFlexibleWhitespaceMatch(approxWindowText, variation)
            if (flexibleMatch) {
              const start = approxWindowStart + flexibleMatch.start
              const end = approxWindowStart + flexibleMatch.end
              const snippet = plainText.slice(start, end)
              if (normalizeForComparison(snippet) === targetNormalized) {
                return { start, end, text: snippet }
              }
            }
          }
        }
        return null
      }

      const verifyAndReturnMatch = (
        match: { start: number; end: number; text?: string | null } | null,
        label: string
      ) => {
        if (!match) return null
        const snippet = match.text ?? plainText.slice(match.start, match.end)
        if (!snippet) return null
        const normalizedSnippet = normalizeForComparison(snippet)
        if (!normalizedSnippet) return null
        if (normalizedSnippet !== targetNormalized) {
          return null
        }
        const safeStart = Math.max(0, Math.min(match.start, match.end))
        const safeEnd = Math.max(safeStart, Math.max(match.start, match.end))
        if (Math.abs(safeStart - approxNormalizedStart) > positionTolerance) {
          console.log('⛔ highlight match rejected (position mismatch)', {
            label,
            safeStart,
            expectedStart: approxNormalizedStart,
            positionTolerance,
          })
          return null
        }
        return {
          start: safeStart,
          end: safeEnd,
          textForHighlight: snippet,
        }
      }

      const candidateMatches = tryMatchInWindow([
        domSelectedText,
        cleanDomSelected,
        textRaw,
        targetNormalized,
      ])
      const verifiedWindowMatch = verifyAndReturnMatch(candidateMatches, 'window')
      if (verifiedWindowMatch) {
        return logMatch('window', verifiedWindowMatch.start, verifiedWindowMatch.end)
      }

      let normalizedMatch = findBestTextMatch(plainText, cleanDomSelected, {
        before: beforeContext,
        after: afterContext,
      })
      let verified = verifyAndReturnMatch(normalizedMatch, 'bestText-cleanDom')
      if (verified)
        return logMatch('bestText-cleanDom', verified.start, verified.end)

      normalizedMatch = findFlexibleWhitespaceMatch(plainText, cleanDomSelected)
      verified = verifyAndReturnMatch(normalizedMatch, 'flex-cleanDom')
      if (verified)
        return logMatch('flex-cleanDom', verified.start, verified.end)

      normalizedMatch = findBestTextMatch(plainText, textRaw, {
        before: beforeContext,
        after: afterContext,
      })
      verified = verifyAndReturnMatch(normalizedMatch, 'bestText-textRaw')
      if (verified) return logMatch('bestText-textRaw', verified.start, verified.end)

      normalizedMatch = findFlexibleWhitespaceMatch(plainText, textRaw)
      verified = verifyAndReturnMatch(normalizedMatch, 'flex-textRaw')
      if (verified) return logMatch('flex-textRaw', verified.start, verified.end)

      // Fallback: align DOM offsets to normalized plain text length proportionally
      const ratio = plainText.length / Math.max(domPlainText.length, 1)
      const approxStart = Math.max(0, Math.floor(domStart * ratio))
      let approxEnd = Math.max(approxStart, Math.floor(domEnd * ratio))
      const minimumLength =
        domSelectedText.length || cleanDomSelected.length || textRaw.trim().length
      if (approxEnd <= approxStart && minimumLength > 0) {
        approxEnd = Math.min(
          plainText.length,
          approxStart + Math.max(Math.round(minimumLength * ratio) || minimumLength, 1)
        )
      }
      const fallbackText = plainText.slice(approxStart, approxEnd)
      if (normalizeForComparison(fallbackText) === targetNormalized) {
        if (Math.abs(approxStart - approxNormalizedStart) > positionTolerance) {
          console.log('⛔ highlight fallback rejected (position mismatch)', {
            approxStart,
            expectedStart: approxNormalizedStart,
            positionTolerance,
          })
        } else {
          return logMatch('fallback-ratio', approxStart, approxEnd, fallbackText)
        }
      }

      const plainTextSlice = plainText.slice(approxWindowStart, approxWindowEnd)
      console.error('⚠️ highlight mapping failed', {
        domSelectedText,
        cleanDomSelected,
        textRaw,
        plainTextSlice,
        originalTextContent,
      })

      throw new Error('Unable to map highlighted text to normalized question content')
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to compute HTML highlight offsets')
    } finally {
      if (normalizedContainer) {
        normalizedContainer.remove()
      }
    }
  }

  // Original logic for non-HTML content
  const normalizedContainer = createNormalizedContainerForSelection(container)

  try {
    // Get normalized plain text using the same method as HighlightedTextRenderer
    const visibleText = getVisiblePlainText(normalizedContainer)
    const originalText = getVisiblePlainText(container)

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
    }

    // Improved fallback: Try multiple text matching approaches
    if (start < 0 || end < 0) {
      const trimmedText = textRaw.trim()

      // First try: direct match in normalized text
      const directIndex = visibleText.indexOf(trimmedText)
      if (directIndex >= 0) {
        start = directIndex
        end = directIndex + trimmedText.length
        textForHighlight = trimmedText
      } else {
        // Second try: enhanced text matching
        const enhancedMatch = findBestTextMatch(visibleText, trimmedText)
        if (enhancedMatch) {
          start = enhancedMatch.start
          end = enhancedMatch.end
          textForHighlight = enhancedMatch.text
        } else {
          // Third try: match in original text and calculate proportional offset
          const originalDirectIndex = originalText.indexOf(trimmedText)
          if (originalDirectIndex >= 0 && originalText.length > 0) {
            const ratio = visibleText.length / originalText.length
            start = Math.floor(originalDirectIndex * ratio)
            end = Math.floor((originalDirectIndex + trimmedText.length) * ratio)
            // Verify the calculated range makes sense
            const calculatedText = visibleText.slice(start, end)
            if (calculatedText.trim() !== trimmedText) {
              // Adjust if text doesn't match
              const adjustedMatch = findBestTextMatch(visibleText, trimmedText)
              if (adjustedMatch) {
                start = adjustedMatch.start
                end = adjustedMatch.end
                textForHighlight = adjustedMatch.text
              }
            }
          }
        }
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
  tempDiv.className = originalContainer.className // Preserve styles that might affect text rendering

  document.body.appendChild(tempDiv)

  try {
    // Apply same sanitization as HighlightedTextRenderer
    sanitizeHtmlContainer(tempDiv)
  } catch (error) {
  }

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
  isHtml?: boolean
  originalText?: string
}

export default function FloatingHighlightButton({
  containerRef,
  onHighlight,
  examTitle,
  examId,
  isHtml = false,
  originalText = '',
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
  const isPointerDownRef = useRef(false) // Track pointer state to avoid interrupting drags

  // Clear cached selection/range info whenever the underlying content swaps out
  useEffect(() => {
    storedRangeRef.current = null
    isStickyRef.current = false
    isRestoringRef.current = false
    isPointerDownRef.current = false
  }, [originalText, containerRef])

  const scheduleHide = (ms: number) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current && !isStickyRef.current) {
        setIsVisible(false)
      }
    }, ms)
  }

  useEffect(() => {
    // Heuristic: clamp selection to the start block when it crosses into another block
    const getClosestBlockElement = (node: Node | null): Element | null => {
      let el: Node | null = node
      while (el && el.nodeType !== Node.ELEMENT_NODE) el = el.parentNode
      while (el && el.nodeType === Node.ELEMENT_NODE) {
        const elem = el as Element
        const tag = elem.tagName
        const display = window.getComputedStyle(elem).display
        if (
          display === 'block' ||
          display === 'list-item' ||
          display === 'table' ||
          display === 'flex' ||
          display === 'grid' ||
          /^(P|DIV|LI|UL|OL|H[1-6]|SECTION|ARTICLE|ASIDE|NAV)$/i.test(tag)
        ) {
          return elem
        }
        el = elem.parentNode
      }
      return null
    }

    const getLastVisibleTextPositionIn = (
      scopeEl: Element
    ): { node: Text; offset: number } | null => {
      try {
        const walker = getTextWalker(scopeEl)
        let lastText: Text | null = null
        while (walker.nextNode()) {
          const n = walker.currentNode as Text
          if ((n.nodeValue || '').length > 0) lastText = n
        }
        if (lastText) {
          return { node: lastText, offset: lastText.data.length }
        }
      } catch {}
      return null
    }

    const processSelection = (selection: Selection) => {
      if (!containerRef.current) return

      let range = selection.getRangeAt(0)

      // Clamp cross-paragraph selections to the start block to avoid bleeding into question stem
      const startBlock = getClosestBlockElement(range.startContainer)
      const endBlock = getClosestBlockElement(range.endContainer)
      if (
        startBlock &&
        endBlock &&
        startBlock !== endBlock &&
        containerRef.current.contains(startBlock) &&
        containerRef.current.contains(endBlock)
      ) {
        const lastPos = getLastVisibleTextPositionIn(startBlock)
        if (lastPos) {
          const clamped = range.cloneRange()
          try {
            clamped.setEnd(lastPos.node, Math.max(0, lastPos.offset))
            range = clamped
          } catch {}
        }
      }

      const textRaw = range.toString()


      if (!textRaw || textRaw.trim().length === 0) {
        if (!isStickyRef.current && !selectedText) {
          scheduleHide(1500)
        }
        return
      }

      const startWithinContainer = containerRef.current.contains(range.startContainer)
      const endWithinContainer = containerRef.current.contains(range.endContainer)

      if (!startWithinContainer || !endWithinContainer) {
        if (!isStickyRef.current && !selectedText) {
          scheduleHide(1500)
        }
        return
      }

      isStickyRef.current = true
      storedRangeRef.current = range.cloneRange()

      const containerElement = containerRef.current

      if (!containerElement.contains(range.commonAncestorContainer)) {
        console.warn('Selection range is outside target container')
        return
      }

      try {
        const { start, end, textForHighlight } = computeOffsetsWithoutTrim(
          containerElement,
          range,
          textRaw,
          isHtml,
          originalText
        )

        if (start < 0 || end <= start || textForHighlight.trim().length === 0) {
          console.warn('Invalid selection offsets calculated:', {
            start,
            end,
            textForHighlight,
          })
          return
        }


        const rect = range.getBoundingClientRect()
        const containerRect = containerElement.getBoundingClientRect()

        const minimalOffset = 8
        const buttonWidth = 88
        const buttonHeight = 44

        const selectionRect = rect.width || rect.height
          ? rect
          : range.endContainer.parentElement?.getBoundingClientRect() || rect

        let buttonX =
          selectionRect.left - containerRect.left + selectionRect.width / 2
        let buttonY = selectionRect.top - containerRect.top - buttonHeight - minimalOffset

        const containerHeight = containerRect.height
        const containerWidth = containerRect.width
        const spaceAbove = selectionRect.top - containerRect.top
        const spaceBelow = containerHeight - (selectionRect.bottom - containerRect.top)

        if (buttonY < minimalOffset) {
          if (spaceBelow >= buttonHeight + minimalOffset * 2) {
            buttonY =
              selectionRect.bottom - containerRect.top + minimalOffset
          } else if (spaceAbove >= buttonHeight + minimalOffset * 2) {
            buttonY =
              selectionRect.top - containerRect.top - buttonHeight - minimalOffset
          } else {
            buttonY = Math.max(minimalOffset, containerHeight - buttonHeight - minimalOffset)
          }
        }

        if (buttonX < minimalOffset) {
          buttonX = minimalOffset
        } else if (buttonX > containerWidth - buttonWidth - minimalOffset) {
          buttonX = containerWidth - buttonWidth - minimalOffset
        }

        if (selectionRect.top - containerRect.top < minimalOffset) {
          buttonY =
            selectionRect.bottom - containerRect.top + minimalOffset
        } else if (
          selectionRect.bottom - containerRect.top >
          containerHeight - buttonHeight - minimalOffset
        ) {
          buttonY =
            selectionRect.top - containerRect.top - buttonHeight - minimalOffset
        }

        if (
          buttonY < minimalOffset &&
          selectionRect.bottom - containerRect.top + buttonHeight + minimalOffset <=
            containerHeight
        ) {
          buttonY =
            selectionRect.bottom - containerRect.top + minimalOffset
        } else if (
          buttonY + buttonHeight > containerHeight - minimalOffset &&
          selectionRect.top - containerRect.top - buttonHeight - minimalOffset >=
            0
        ) {
          buttonY =
            selectionRect.top - containerRect.top - buttonHeight - minimalOffset
        } else {
          const selectionMiddleY =
            rect.top + rect.height / 2 - containerRect.top
          if (
            selectionMiddleY - buttonHeight / 2 >= 0 &&
            selectionMiddleY + buttonHeight / 2 <= containerHeight
          ) {
            buttonY = selectionMiddleY - buttonHeight / 2
          } else {
            buttonY =
              spaceBelow > spaceAbove
                ? Math.max(0, containerHeight - buttonHeight)
                : 0
          }
        }

        buttonX = Math.max(
          minimalOffset,
          Math.min(buttonX, containerWidth - buttonWidth - minimalOffset)
        )
        buttonY = Math.max(
          minimalOffset,
          Math.min(buttonY, containerHeight - buttonHeight - minimalOffset)
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
        isStickyRef.current = false
        storedRangeRef.current = null
        if (error instanceof Error) {
          toast.error(
            error.message.includes('Unable to map')
              ? '선택한 문장을 정확히 찾지 못했어요. 조금 더 짧게 선택하거나 다시 시도해 주세요.'
              : '하이라이트를 적용할 수 없었어요. 다시 시도해 주세요.'
          )
        } else {
          toast.error('하이라이트를 적용할 수 없었어요. 다시 시도해 주세요.')
        }
      }
    }

    const handleSelectionChange = () => {
      if (isRestoringRef.current) return

      const selection = window.getSelection()

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }

      if (!selection || !containerRef.current || selection.rangeCount === 0) {
        if (!isStickyRef.current && !selectedText) {
          scheduleHide(1500)
        }
        return
      }

      if (selection.isCollapsed) {
        return
      }

      if (isPointerDownRef.current) {
        return
      }

      processSelection(selection)
    }

    const handlePointerDown = () => {
      isPointerDownRef.current = true
    }

    const handlePointerUp = () => {
      isPointerDownRef.current = false

      if (isRestoringRef.current) return
      if (!containerRef.current) return

      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return
      }

      const anchorNode = selection.anchorNode
      const focusNode = selection.focusNode
      if (
        !anchorNode ||
        !focusNode ||
        !containerRef.current.contains(anchorNode) ||
        !containerRef.current.contains(focusNode)
      ) {
        return
      }

      processSelection(selection)
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node

      // Don't hide immediately if clicking on the button itself
      if (buttonRef.current && buttonRef.current.contains(target)) {
        return
      }

      const clickedInsideContainer =
        containerRef.current && containerRef.current.contains(target)

      if (!clickedInsideContainer) {
        // User clicked completely outside → release sticky mode
        isStickyRef.current = false
        storedRangeRef.current = null
        setSelectedText('')
        setSelectionRange(null)
      }

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
        }
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mousedown', handleClickOutside)
    // Also gate selection handling on classic mouse events for broader browser support
    const setMouseDown = () => {
      isPointerDownRef.current = true
    }
    const setMouseUp = () => {
      isPointerDownRef.current = false
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerUp)
    document.addEventListener('mouseup', setMouseUp)
    document.addEventListener('mousedown', setMouseDown)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)
      document.removeEventListener('mouseup', setMouseUp)
      document.removeEventListener('mousedown', setMouseDown)
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

    // Clear the selection immediately to allow fresh selections
    if (window.getSelection()) {
      window.getSelection()?.removeAllRanges()
    }

    // Force re-enable selection handling after DOM updates
    setTimeout(() => {
      isRestoringRef.current = false
      console.log('Selection cleared and ready for new selections')
    }, 50)
  }

  const handleHighlight = () => {
    if (selectionRange && selectedText) {

      onHighlight({
        start: selectionRange.start,
        end: selectionRange.end,
        text: selectedText,
      })

      // Clear UI immediately and prepare for new selections
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
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      restoreSelection()
    }
  }

  const handleMouseLeave = () => {
    isHoveringRef.current = false
    // Start hide timeout when leaving button
    scheduleHide(2000)
  }

  const onButtonMouseDown: React.MouseEventHandler = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      restoreSelection()
    }
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
