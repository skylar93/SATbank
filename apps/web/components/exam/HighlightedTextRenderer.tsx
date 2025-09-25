'use client'
import React from 'react'
import {
  renderHtmlContent,
  renderTextWithFormattingAndMath,
} from './question-display'
import { ContentRenderer } from '../content-renderer'
import {
  Highlight,
  createNormalizedContainer,
  getVisiblePlainText,
  createStablePositionMapping,
  getNodeByXPath,
  findFlexibleWhitespaceMatch,
  PositionMap,
  debugHighlightIssue,
} from './text-utils'

interface Props {
  text: string
  highlights: Highlight[]
  onRemoveHighlight?: (highlight: Highlight) => void
  isHtml?: boolean // Flag to indicate if content is HTML
}

// New robust highlight application using stable positioning
function applyHighlightsToHTML(htmlContent: string, highlights: Highlight[]): string {
  if (!highlights || highlights.length === 0) return htmlContent

  try {
    // Use normalized container for consistent processing
    const { container, plainText } = createNormalizedContainer(htmlContent)

    try {
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

        // More lenient text validation with flexible whitespace matching
        const expectedText = plainText.substring(highlight.start, highlight.end)
        const normalizeSpace = (s: string) => s.replace(/\s+/g, ' ').trim()

        if (normalizeSpace(expectedText) !== normalizeSpace(highlight.text)) {
          // Try flexible whitespace matching
          const flexibleMatch = findFlexibleWhitespaceMatch(plainText, highlight.text)
          if (!flexibleMatch || flexibleMatch.start !== highlight.start) {
            console.warn('Highlight text mismatch (normalized):', {
              expected: normalizeSpace(highlight.text),
              found: normalizeSpace(expectedText),
              start: highlight.start,
              end: highlight.end,
            })
            // Continue anyway for better compatibility
          }
        }

        return true
      })

      if (validHighlights.length === 0) {
        return container.innerHTML
      }

      // Sort highlights by start position (apply in reverse order)
      const sortedHighlights = [...validHighlights].sort((a, b) => b.start - a.start)

      // Apply each highlight using a more reliable method
      for (const highlight of sortedHighlights) {
        try {
          applyHighlightRobust(container, highlight, plainText)
        } catch (error) {
          console.warn('Failed to apply highlight:', error, highlight)
          debugHighlightIssue(container, highlight, plainText, 'applyHighlightsToHTML')
          // Continue with other highlights
        }
      }

      return container.innerHTML
    } finally {
      container.remove()
    }
  } catch (error) {
    console.error('Failed to create normalized container:', error)
    return htmlContent
  }
}

// Robust highlight application for a single highlight
function applyHighlightRobust(container: Element, highlight: Highlight, plainText: string): void {
  const { start, end } = highlight

  // Create a fresh position mapping each time
  const mapping = createStablePositionMapping(container)

  // Check if mapping matches the expected plain text length
  if (mapping.length !== plainText.length) {
    console.warn('Position mapping length mismatch, falling back to text replacement')
    console.warn(`Mapping: ${mapping.length}, Plain text: ${plainText.length}`)
    applyHighlightViaTextReplacementSingle(container as HTMLElement, highlight, 0)
    return
  }

  // Find start and end positions in DOM
  const startMap = mapping[start]
  const endMap = mapping[end - 1] // end is exclusive

  if (!startMap || !endMap) {
    console.warn('Could not find DOM positions for highlight range')
    console.warn(`Start: ${start}, End: ${end}, Mapping length: ${mapping.length}`)
    applyHighlightViaTextReplacementSingle(container as HTMLElement, highlight, 0)
    return
  }

  // Handle case where highlight spans multiple text nodes
  const startNode = getNodeByXPath(startMap.xpath, container)
  const endNode = getNodeByXPath(endMap.xpath, container)

  if (!startNode || !endNode || startNode.nodeType !== Node.TEXT_NODE || endNode.nodeType !== Node.TEXT_NODE) {
    console.warn('Could not resolve XPath to text nodes')
    console.warn(`Start XPath: ${startMap.xpath}, End XPath: ${endMap.xpath}`)
    applyHighlightViaTextReplacementSingle(container as HTMLElement, highlight, 0)
    return
  }

  try {
    const range = document.createRange()
    range.setStart(startNode, startMap.nodeOffset)
    range.setEnd(endNode, endMap.nodeOffset + 1)

    const mark = document.createElement('mark')
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
