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

// Enhanced helper functions for better text processing
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

// New stable approach: Use XPath-based positioning for robustness
function getNodeXPath(node: Node, container: Element): string {
  if (node === container) return ''

  const path: string[] = []
  let current = node

  while (current && current !== container) {
    let index = 0
    let sibling = current.previousSibling

    while (sibling) {
      if (sibling.nodeType === current.nodeType) {
        if (sibling.nodeType === Node.TEXT_NODE || sibling.nodeName === current.nodeName) {
          index++
        }
      }
      sibling = sibling.previousSibling
    }

    const tagName = current.nodeType === Node.TEXT_NODE ? 'text()' : current.nodeName.toLowerCase()
    path.unshift(`${tagName}[${index + 1}]`)
    current = current.parentNode as Node
  }

  return path.join('/')
}

function getNodeByXPath(xpath: string, container: Element): Node | null {
  if (!xpath) return container

  try {
    const result = document.evaluate(
      xpath,
      container,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    )
    return result.singleNodeValue
  } catch (error) {
    console.warn('XPath evaluation failed:', error)
    return null
  }
}

// Position mapping interface
interface PositionMap {
  plaintextIndex: number
  domNode: Node
  nodeOffset: number
  xpath: string
}

// Create robust position mapping using XPath
function createStablePositionMapping(container: Element): PositionMap[] {
  const mapping: PositionMap[] = []
  let plaintextIndex = 0

  const walker = getTextWalker(container)
  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text
    const textContent = textNode.data
    const xpath = getNodeXPath(textNode, container)

    for (let i = 0; i < textContent.length; i++) {
      mapping.push({
        plaintextIndex,
        domNode: textNode,
        nodeOffset: i,
        xpath,
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

// Get visible plain text from container, preserving all spacing
function getVisiblePlainText(container: Element): string {
  const walker = getTextWalker(container)
  let text = ''
  while (walker.nextNode()) {
    text += (walker.currentNode as Text).data
  }
  return text
}

// Sanitize HTML by removing non-visible elements
function sanitizeHtmlContainer(div: HTMLDivElement) {
  // Remove elements that should never affect visible question content
  div
    .querySelectorAll('style,script,noscript,template,iframe,object')
    .forEach((el) => el.remove())

  // Remove MathQuill editing scaffolding that is hidden in the live view
  div.querySelectorAll('.mq-textarea, .mq-cursor, .mq-selection').forEach((el) => {
    el.remove()
  })

  // Remove orphan textarea/input nodes that are hidden via CSS in the real DOM
  div.querySelectorAll('textarea, input[type="hidden"]').forEach((el) => {
    const parent = el.parentElement
    // Drop empty wrappers such as <span class="mq-textarea"><textarea/></span>
    if (parent && parent.childNodes.length === 1) {
      parent.remove()
    } else {
      el.remove()
    }
  })

  // Drop elements that are explicitly marked hidden
  div.querySelectorAll('[hidden]').forEach((el) => el.remove())

  div.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const style = el.getAttribute('style')?.toLowerCase() ?? ''
    if (
      style.includes('display:none') ||
      style.includes('display: none') ||
      style.includes('visibility:hidden') ||
      style.includes('visibility: hidden')
    ) {
      el.remove()
    }
  })
  // Note: aria-hidden elements are kept in DOM but excluded from walker for consistency
}

// New robust highlight application using stable positioning
function applyHighlightsToHTML(htmlContent: string, highlights: Highlight[]): string {
  if (!highlights || highlights.length === 0) return htmlContent

  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent

  // Append off-screen so computed styles match the live DOM (important for hidden MathQuill nodes)
  tempDiv.style.position = 'absolute'
  tempDiv.style.left = '-9999px'
  tempDiv.style.top = '-9999px'
  tempDiv.style.pointerEvents = 'none'
  tempDiv.style.opacity = '0'
  tempDiv.style.zIndex = '-1'

  const { body } = document
  if (!body) {
    return htmlContent
  }

  body.appendChild(tempDiv)

  try {
    // Sanitize to remove non-visible content before processing
    sanitizeHtmlContainer(tempDiv)

    // Get visible plaintext for validation
    const plainText = getVisiblePlainText(tempDiv)

    // Validate highlights against visible text
    const validHighlights = highlights.filter((highlight) => {
      if (
        highlight.start < 0 ||
        highlight.end > plainText.length ||
        highlight.start >= highlight.end
      ) {
        console.warn(
          'Invalid highlight range:',
          highlight,
          'visible plaintext length:',
          plainText.length
        )
        return false
      }

      // More lenient text validation
      const expectedText = plainText.substring(highlight.start, highlight.end)
      const normalizeSpace = (s: string) => s.replace(/\s+/g, ' ').trim()
      if (normalizeSpace(expectedText) !== normalizeSpace(highlight.text)) {
        console.warn('Highlight text mismatch (normalized):', {
          expected: normalizeSpace(highlight.text),
          found: normalizeSpace(expectedText),
          start: highlight.start,
          end: highlight.end,
        })
        // Continue anyway for better compatibility
      }

      return true
    })

    if (validHighlights.length === 0) {
      return tempDiv.innerHTML
    }

    // Sort highlights by start position (apply in reverse order)
    const sortedHighlights = [...validHighlights].sort((a, b) => b.start - a.start)

    // Apply each highlight using a more reliable method
    for (const highlight of sortedHighlights) {
      try {
        applyHighlightRobust(tempDiv, highlight, plainText)
      } catch (error) {
        console.warn('Failed to apply highlight:', error, highlight)
        // Continue with other highlights
      }
    }

    return tempDiv.innerHTML
  } finally {
    tempDiv.remove()
  }
}

// Robust highlight application for a single highlight
function applyHighlightRobust(container: Element, highlight: Highlight, plainText: string): void {
  const { start, end } = highlight

  // Create a fresh position mapping each time
  const mapping = createStablePositionMapping(container)

  if (mapping.length !== plainText.length) {
    console.warn('Position mapping length mismatch, falling back to text replacement')
    applyHighlightViaTextReplacementSingle(container as HTMLElement, highlight, 0)
    return
  }

  // Find start and end positions in DOM
  const startMap = mapping[start]
  const endMap = mapping[end - 1] // end is exclusive

  if (!startMap || !endMap) {
    console.warn('Could not find DOM positions for highlight range')
    return
  }

  // Handle case where highlight spans multiple text nodes
  const startNode = getNodeByXPath(startMap.xpath, container)
  const endNode = getNodeByXPath(endMap.xpath, container)

  if (!startNode || !endNode || startNode.nodeType !== Node.TEXT_NODE || endNode.nodeType !== Node.TEXT_NODE) {
    console.warn('Could not resolve XPath to text nodes')
    return
  }

  try {
    const range = document.createRange()
    range.setStart(startNode, startMap.nodeOffset)
    range.setEnd(endNode, endMap.nodeOffset + 1)

    const mark = document.createElement('mark')

    // 🎯 CRITICAL: 강제 인라인 스타일 (절대 건드리지 말 것!)
    mark.style.backgroundColor = '#fef08a' // 노란 배경
    mark.style.padding = '2px 4px'
    mark.style.borderRadius = '4px'
    mark.style.fontWeight = 'bold' // 굵은 글씨
    mark.style.border = '2px solid #f59e0b' // 디버깅용 테두리
    mark.style.zIndex = '999'
    mark.style.display = 'inline' // 연결되게 하기 위함

    mark.className = 'bg-yellow-200 rounded px-1 cursor-pointer hover:bg-yellow-300 transition-colors'
    mark.title = 'Click to remove highlight'
    mark.setAttribute('data-highlight-start', String(start))
    mark.setAttribute('data-highlight-end', String(end))
    mark.setAttribute('data-highlight-text', highlight.text)

    // Try to surround contents, fallback to manual insertion
    try {
      range.surroundContents(mark)
    } catch {
      const contents = range.extractContents()
      mark.appendChild(contents)
      range.insertNode(mark)
    }
  } catch (error) {
    console.warn('Failed to create range for highlight:', error)
    // Final fallback to text replacement
    applyHighlightViaTextReplacementSingle(container as HTMLElement, highlight, 0)
  }
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
               style="background-color: #fef08a; padding: 2px 4px; border-radius: 4px; font-weight: bold; border: 2px solid #f59e0b; z-index: 999; display: inline;"
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

// Helper function to render HTML with click handler using improved positioning
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
        // Try to find highlight by data attributes
        const start = Number(target.getAttribute('data-highlight-start'))
        const end = Number(target.getAttribute('data-highlight-end'))
        const text = target.getAttribute('data-highlight-text')

        if (Number.isFinite(start) && Number.isFinite(end)) {
          // Find exact match by position and text
          const exact = highlights.find(h =>
            h.start === start && h.end === end && h.text === text
          )
          if (exact) {
            onRemoveHighlight(exact)
            return
          }

          // Fallback: find by position only
          const byPosition = highlights.find(h => h.start === start && h.end === end)
          if (byPosition) {
            onRemoveHighlight(byPosition)
            return
          }
        }

        // Final fallback: find by text content
        const textContent = target.textContent || ''
        const byText = highlights.find(h => h.text === textContent)
        if (byText) {
          onRemoveHighlight(byText)
        }
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

  // Use improved position mapping for HTML content highlighting
  if (isHtml) {
    try {
      // Apply highlights using the robust approach
      const highlightedHtml = applyHighlightsToHTML(text, highlights)

      // Render with click handler for highlight removal
      return renderHtmlWithClickHandler(highlightedHtml, highlights, onRemoveHighlight)
    } catch (error) {
      console.error('Failed to apply HTML highlights, falling back to original content:', error)
      return renderHtmlContent(text)
    }
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
