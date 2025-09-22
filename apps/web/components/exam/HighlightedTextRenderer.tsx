'use client'
import React from 'react'
import {
  renderHtmlContent,
  renderTextWithFormattingAndMath,
} from './question-display'
import { ContentRenderer } from '../content-renderer'

interface Highlight {
  start: number
  end: number
  text: string
}

// Helper functions for visible text processing
function isVisibleTextNode(n: Node): n is Text {
  if (n.nodeType !== Node.TEXT_NODE) return false
  const el = n.parentElement
  if (!el) return false
  const tag = el.tagName
  if (['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE'].includes(tag)) return false
  const cs = window.getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden') return false
  if (el.getAttribute('aria-hidden') === 'true') return false
  return true
}

function getTextWalker(root: Node) {
  return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return isVisibleTextNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    }
  })
}

// Segment-based highlighting for better overlap handling
type HighlightSegment = { start: number; end: number; layer: number }

function partitionIntoSegments(highlights: Highlight[]): HighlightSegment[] {
  const points: number[] = []
  highlights.forEach(h => { points.push(h.start, h.end) })
  const uniq = Array.from(new Set(points)).sort((a, b) => a - b)
  const segments: HighlightSegment[] = []
  
  for (let i = 0; i < uniq.length - 1; i++) {
    const a = uniq[i], b = uniq[i + 1]
    const layer = highlights.reduce((acc, h) => acc + (h.start < b && h.end > a ? 1 : 0), 0)
    if (layer > 0) segments.push({ start: a, end: b, layer })
  }
  
  return segments
}

// Create position mapping from visible text only
function createVisiblePositionMapping(container: Element): PositionMap[] {
  const mapping: PositionMap[] = []
  let plaintextIndex = 0
  
  const walker = getTextWalker(container)
  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text
    const textContent = textNode.data
    const blockEl = getNearestBlockAncestor(textNode, container)
    
    for (let i = 0; i < textContent.length; i++) {
      mapping.push({
        plaintextIndex,
        domNode: textNode,
        nodeOffset: i,
        blockEl,
      })
      plaintextIndex++
    }
  }
  
  return mapping
}

interface Props {
  text: string
  highlights: Highlight[]
  onRemoveHighlight?: (highlight: Highlight) => void
  isHtml?: boolean // Flag to indicate if content is HTML
}

// Helper function to get plain text from HTML string
function getPlainTextFromHtml(htmlString: string): string {
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlString
  return tempDiv.textContent || tempDiv.innerText || ''
}

// Position mapping between plaintext and DOM nodes
interface PositionMap {
  plaintextIndex: number
  domNode: Node
  nodeOffset: number
  blockEl: Element
}

// Find nearest block ancestor: closest ancestor with display !== inline
function getNearestBlockAncestor(node: Node, root: Element): Element {
  let el: Element | null =
    node.nodeType === Node.TEXT_NODE ? (node.parentElement) : (node as Element)

  while (el && el !== root) {
    const cs = window.getComputedStyle(el)
    // inline이 아니면 블록 컨테이너로 취급 (block, inline-block, list-item, table-cell, flex, grid 등)
    if (cs.display !== 'inline') return el
    el = el.parentElement
  }
  return root
}

// Create position mapping from HTML to plaintext
function createPositionMapping(container: Element): PositionMap[] {
  const mapping: PositionMap[] = []
  let plaintextIndex = 0
  
  function walkTextNodes(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent || ''
      const blockEl = getNearestBlockAncestor(node, container)
      for (let i = 0; i < textContent.length; i++) {
        mapping.push({
          plaintextIndex,
          domNode: node,
          nodeOffset: i,
          blockEl,
        })
        plaintextIndex++
      }
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        walkTextNodes(node.childNodes[i])
      }
    }
  }
  
  walkTextNodes(container)
  return mapping
}

// Sanitize HTML by removing non-visible elements
function sanitizeHtmlContainer(div: HTMLDivElement) {
  div.querySelectorAll('style,script,noscript,template').forEach(el => el.remove())
  // Note: aria-hidden elements are kept in DOM but excluded from walker for consistency
}

// Apply highlights using segment-based approach for better overlap handling
function applyHighlightsToHTML(htmlContent: string, highlights: Highlight[]): string {
  if (!highlights || highlights.length === 0) return htmlContent
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent
  
  // Sanitize to remove non-visible content before processing
  sanitizeHtmlContainer(tempDiv)
  
  // Get visible plaintext for validation and mapping
  const walker = getTextWalker(tempDiv)
  let plainText = ''
  while (walker.nextNode()) {
    plainText += (walker.currentNode as Text).data
  }
  
  // More lenient validation - only check range validity, not exact text match
  const validHighlights = highlights.filter(highlight => {
    if (highlight.start < 0 || highlight.end > plainText.length || highlight.start >= highlight.end) {
      console.warn('Invalid highlight range:', highlight, 'visible plaintext length:', plainText.length)
      return false
    }
    
    // Optional: softer text validation with normalized whitespace comparison
    const expectedText = plainText.substring(highlight.start, highlight.end)
    const normalizeSpace = (s: string) => s.replace(/\s+/g, ' ').trim()
    if (normalizeSpace(expectedText) !== normalizeSpace(highlight.text)) {
      console.warn('Highlight text mismatch (normalized):', { 
        expected: normalizeSpace(highlight.text), 
        found: normalizeSpace(expectedText),
        start: highlight.start,
        end: highlight.end
      })
      // Still allow it - don't return false here for better compatibility
    }
    
    return true
  })
  
  if (validHighlights.length === 0) {
    return htmlContent
  }
  
  // Use segment-based approach
  const segments = partitionIntoSegments(validHighlights)
  const mapping = createVisiblePositionMapping(tempDiv)
  
  if (mapping.length !== plainText.length) {
    console.warn('Visible position mapping length mismatch:', mapping.length, 'vs', plainText.length)
    return applyHighlightsViaTextReplacement(htmlContent, validHighlights)
  }
  
  // Apply segments in reverse order for safe DOM insertion
  const sortedSegments = [...segments].sort((a, b) => b.start - a.start)
  
  for (const segment of sortedSegments) {
    let i = segment.start
    while (i < segment.end) {
      // 현재 블록 조상
      const first = mapping[i]
      if (!first) break
      const blockEl = first.blockEl

      // 같은 블록 조상인 구간의 끝 j 찾기
      let j = i + 1
      while (j < segment.end && mapping[j] && mapping[j].blockEl === blockEl) {
        j++
      }

      // [i, j) 구간을 mark
      const startMap = mapping[i]
      const endMap = mapping[j - 1]
      if (startMap && endMap) {
        try {
          const range = document.createRange()
          range.setStart(startMap.domNode, startMap.nodeOffset)
          range.setEnd(endMap.domNode, endMap.nodeOffset + 1)

          const mark = document.createElement('mark')
          mark.className = `hl-layer-${Math.min(segment.layer, 3)} rounded px-1 cursor-pointer hover:opacity-80 transition-opacity`
          mark.title = 'Click to remove highlight'
          // 세그먼트 전체 범위를 저장 (부모 하이라이트 탐색에 사용)
          mark.setAttribute('data-seg-start', String(segment.start))
          mark.setAttribute('data-seg-end', String(segment.end))

          try {
            range.surroundContents(mark)
          } catch {
            const contents = range.extractContents()
            mark.appendChild(contents)
            range.insertNode(mark)
          }
        } catch (error) {
          console.warn('Failed to apply block segment:', error, segment)
        }
      }

      i = j // 다음 블록으로 진행
    }
  }
  
  return tempDiv.innerHTML
}

// Fallback method using text replacement
function applyHighlightsViaTextReplacement(htmlContent: string, highlights: Highlight[]): string {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent
  
  // Sort highlights by start position (reverse order for safe replacement)
  const sortedHighlights = [...highlights].sort((a, b) => b.start - a.start)
  
  sortedHighlights.forEach((highlight, highlightIndex) => {
    applyHighlightViaTextReplacementSingle(tempDiv, highlight, highlightIndex)
  })
  
  return tempDiv.innerHTML
}

// Single highlight application via text replacement
function applyHighlightViaTextReplacementSingle(container: HTMLElement, highlight: Highlight, highlightIndex: number): void {
  const textToReplace = highlight.text
  const escapedText = textToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  
  let htmlWithHighlight = container.innerHTML
  
  // Simple text replacement as fallback
  const regex = new RegExp(`(${escapedText})`, 'g')
  let matchCount = 0
  htmlWithHighlight = htmlWithHighlight.replace(regex, (match, p1) => {
    matchCount++
    // Only replace the first match to avoid duplicates
    if (matchCount === 1) {
      return `<mark class="bg-yellow-200 rounded px-1 cursor-pointer hover:bg-yellow-300 transition-colors" 
               title="Click to remove highlight" 
               data-highlight-text="${textToReplace}" 
               data-highlight-index="${highlightIndex}">${p1}</mark>`
    }
    return match // Return original for subsequent matches
  })
  
  if (matchCount > 0) {
    container.innerHTML = htmlWithHighlight
  } else if (process.env.NODE_ENV === 'development') {
    console.error('Failed to apply highlight - text not found:', textToReplace)
  }
}

// Helper function to escape text for regex
function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Helper function to render HTML with click handler using precise positioning
function renderHtmlWithClickHandler(
  processedHtml: string,
  highlights: Highlight[],
  onRemoveHighlight?: (highlight: Highlight) => void
) {
  // Create a wrapper component that handles highlight removal
  const HtmlWithHighlights = () => {
    const handleClick = (event: React.MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'MARK' && onRemoveHighlight) {
        // 세그먼트 범위로 부모 하이라이트 추정
        const segStart = Number(target.getAttribute('data-seg-start'))
        const segEnd = Number(target.getAttribute('data-seg-end'))
        if (Number.isFinite(segStart) && Number.isFinite(segEnd)) {
          const candidates = highlights
            .filter(h => h.start <= segStart && h.end >= segEnd)
            .sort((a, b) => (a.end - a.start) - (b.end - b.start))
          const toRemove = candidates[0]
          if (toRemove) {
            onRemoveHighlight(toRemove)
            return
          }
        }
        // fallback: 예전 방식도 시도
        const start = Number(target.getAttribute('data-start'))
        const end = Number(target.getAttribute('data-end'))
        const exact = highlights.find(h => h.start === start && h.end === end)
        if (exact) onRemoveHighlight(exact)
      }
    }

    // Render the processed HTML with highlights
    if (processedHtml.includes('data-math')) {
      // Use ContentRenderer for math content
      return (
        <div onClick={handleClick}>
          <ContentRenderer htmlContent={processedHtml} />
        </div>
      )
    }

    return (
      <div
        className="max-w-none [&_*]:!font-[inherit] text-gray-900 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: processedHtml }}
        style={{ fontFamily: 'inherit' }}
        onClick={handleClick}
      />
    )
  }

  return <HtmlWithHighlights />
}

export function HighlightedTextRenderer({
  text,
  highlights,
  onRemoveHighlight,
  isHtml = false,
}: Props) {
  // If no highlights, render as HTML or markdown based on flag
  if (!highlights || highlights.length === 0) {
    return isHtml ? (
      renderHtmlContent(text)
    ) : (
      <>{renderTextWithFormattingAndMath(text)}</>
    )
  }

  // Use position mapping for HTML content highlighting
  if (isHtml) {
    // Apply highlights using the position mapping approach
    const highlightedHtml = applyHighlightsToHTML(text, highlights)
    
    // Render with click handler for highlight removal
    return renderHtmlWithClickHandler(highlightedHtml, highlights, onRemoveHighlight)
  }

  const parts = []
  let lastIndex = 0

  // Sort highlights by start position to ensure proper rendering order
  const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start)

  sortedHighlights.forEach((h, i) => {
    // Text before the highlight
    if (h.start > lastIndex) {
      const beforeText = text.substring(lastIndex, h.start)
      parts.push(
        <span key={`text-${i}`}>
          {renderTextWithFormattingAndMath(beforeText)}
        </span>
      )
    }

    // The highlighted text
    const highlightedText = text.substring(h.start, h.end)
    parts.push(
      <mark
        key={`mark-${i}`}
        className="bg-yellow-200 rounded px-1 cursor-pointer hover:bg-yellow-300 transition-colors"
        title="Click to remove highlight"
        onClick={() => onRemoveHighlight?.(h)}
      >
        {renderTextWithFormattingAndMath(highlightedText)}
      </mark>
    )

    lastIndex = h.end
  })

  // Text after the last highlight
  if (lastIndex < text.length) {
    const afterText = text.substring(lastIndex)
    parts.push(
      <span key="text-last">{renderTextWithFormattingAndMath(afterText)}</span>
    )
  }

  return <>{parts}</>
}

// Memoized version to prevent timer re-renders from affecting selection
export const HighlightedTextRendererMemo = React.memo(
  HighlightedTextRenderer,
  (prev, next) =>
    prev.text === next.text &&
    prev.isHtml === next.isHtml &&
    JSON.stringify(prev.highlights) === JSON.stringify(next.highlights)
)
