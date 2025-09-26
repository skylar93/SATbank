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
function applyHighlightsToHTML(
  htmlContent: string,
  highlights: Highlight[]
): string {
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

        // More flexible text matching to handle partial selections and whitespace differences
        const expectedNormalized = normalizeSpace(expectedText)
        const highlightNormalized = normalizeSpace(highlight.text)

        const isTextMatch = expectedNormalized === highlightNormalized ||
          expectedText.includes(highlight.text.trim()) ||
          highlight.text.trim().includes(expectedText.trim()) ||
          expectedNormalized.includes(highlightNormalized) ||
          highlightNormalized.includes(expectedNormalized) ||
          // 🎯 Very lenient matching for similar text (90% similarity)
          Math.abs(expectedNormalized.length - highlightNormalized.length) <= 3 &&
          (expectedNormalized.includes(highlightNormalized.slice(0, -3)) ||
           highlightNormalized.includes(expectedNormalized.slice(0, -3))) ||
          // Handle cases where only part of the text matches
          (highlightNormalized.length > 10 && expectedNormalized.includes(highlightNormalized.substring(0, Math.floor(highlightNormalized.length * 0.7)))) ||
          (expectedNormalized.length > 10 && highlightNormalized.includes(expectedNormalized.substring(0, Math.floor(expectedNormalized.length * 0.7))))

        if (!isTextMatch) {
          // Try to find the text anywhere in the document for flexible matching
          const highlightTextNormalized = normalizeSpace(highlight.text)
          const fullTextNormalized = normalizeSpace(plainText)

          // Check if the highlight text exists anywhere in the current text
          if (fullTextNormalized.includes(highlightTextNormalized)) {
            console.log('Highlight text found elsewhere in document, trying flexible repositioning:', {
              originalStart: highlight.start,
              originalEnd: highlight.end,
              highlightText: highlightTextNormalized
            })

            // Try to find the text at a different position
            const newStart = fullTextNormalized.indexOf(highlightTextNormalized)
            if (newStart !== -1) {
              // Create a temporary repositioned highlight
              const repositionedHighlight = {
                ...highlight,
                start: newStart,
                end: newStart + highlightTextNormalized.length
              }

              console.log('Using repositioned highlight:', repositionedHighlight)
              // Replace current highlight with repositioned one
              Object.assign(highlight, repositionedHighlight)
              return true
            }
          }

          console.warn('Highlight text mismatch (normalized):', {
            expected: normalizeSpace(highlight.text),
            found: normalizeSpace(expectedText),
            start: highlight.start,
            end: highlight.end,
            fullTextLength: plainText.length
          })

          // Continue anyway for better compatibility, but mark as potentially misaligned
          console.warn('Continuing with potentially misaligned highlight')
        }

        return true
      })

      if (validHighlights.length === 0) {
        return container.innerHTML
      }

      // Sort highlights by start position (apply in reverse order)
      const sortedHighlights = [...validHighlights].sort(
        (a, b) => b.start - a.start
      )

      // Apply each highlight using a more reliable method
      for (const highlight of sortedHighlights) {
        try {
          applyHighlightRobust(container, highlight, plainText)
        } catch (error) {
          console.warn('Failed to apply highlight:', error, highlight)
          debugHighlightIssue(
            container,
            highlight,
            plainText,
            'applyHighlightsToHTML'
          )
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

// More robust highlight application using a different approach for complex HTML
function applyHighlightRobust(
  container: Element,
  highlight: Highlight,
  plainText: string
): void {
  const { start, end } = highlight

  console.log('🎯 applyHighlightRobust called:', {
    start, end,
    text: highlight.text?.slice(0, 50) + '...',
    plainTextLength: plainText.length
  })

  // Try a more reliable text replacement approach for complex selections
  // This approach handles indented text and line breaks better
  try {
    const targetText = highlight.text
    const containerHTML = container.innerHTML

    console.log('🎯🎯🎯 HIGHLIGHT RENDERER: Using improved text replacement approach')
    console.log('🎯🎯🎯 Target text:', targetText)
    console.log('🎯🎯🎯 Container HTML preview:', containerHTML.slice(0, 200) + '...')

    // Create multiple possible patterns to match the text
    const patterns = []

    // Original text exactly as selected
    patterns.push(targetText)

    // Text with normalized whitespace
    const normalizedText = targetText.replace(/\s+/g, ' ').trim()
    if (normalizedText !== targetText) {
      patterns.push(normalizedText)
    }

    // Text split by common HTML break patterns and rejoined
    const htmlSplitPatterns = [
      // Handle <p>, <div>, <br> breaks
      targetText.replace(/\n\s*/g, '\\s*(?:</p>\\s*<p[^>]*>|</div>\\s*<div[^>]*>|<br[^>]*>)\\s*'),
      // Handle indented paragraphs
      targetText.replace(/\n\s+/g, '\\s*</p>\\s*<p[^>]*>\\s*'),
      // Handle simple line breaks
      targetText.replace(/\n/g, '\\s*(?:<br[^>]*>|</p>\\s*<p[^>]*>)\\s*')
    ]

    patterns.push(...htmlSplitPatterns)

    console.log('🎯🎯🎯 Total patterns to try:', patterns.length)

    // Try each pattern
    let replaced = false
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i]
      try {
        console.log(`🎯🎯🎯 Trying pattern ${i + 1}/${patterns.length}:`, pattern.slice(0, 100) + (pattern.length > 100 ? '...' : ''))

        // Escape special regex characters, but keep our HTML break patterns
        const escapedPattern = pattern.includes('\\s*') ?
          pattern :
          pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

        const regex = new RegExp(`(${escapedPattern})`, 'gi')
        const matches = containerHTML.match(regex)

        console.log(`🎯🎯🎯 Pattern ${i + 1} matches:`, matches ? matches.length : 0)

        if (matches && matches.length > 0) {
          console.log('🎯🎯🎯 MATCH FOUND! Pattern:', pattern.slice(0, 50) + '...')
          console.log('🎯🎯🎯 Match content:', matches[0].slice(0, 100) + '...')

          // Replace with highlighted version
          const highlightedHTML = containerHTML.replace(regex, (match) => {
            console.log('🎯🎯🎯 Replacing match with highlight markup...')
            return `<mark class="highlight-mark"
                      style="background-color: #fef08a !important;
                             padding: 2px 4px !important;
                             border-radius: 4px !important;
                             cursor: pointer !important;
                             font-weight: bold !important;
                             border: 2px solid #f59e0b !important;
                             display: inline !important;
                             z-index: 999 !important;
                             box-decoration-break: clone !important;
                             -webkit-box-decoration-break: clone !important;"
                      title="Click to remove highlight"
                      data-highlight-start="${start}"
                      data-highlight-end="${end}"
                      data-highlight-text="${highlight.text.replace(/"/g, '&quot;')}">${match}</mark>`
          })

          if (highlightedHTML !== containerHTML) {
            console.log('🎯🎯🎯 HTML changed, applying to container...')
            console.log('🎯🎯🎯 Before:', containerHTML.slice(0, 100) + '...')
            console.log('🎯🎯🎯 After:', highlightedHTML.slice(0, 100) + '...')
            container.innerHTML = highlightedHTML
            replaced = true
            console.log('✅✅✅ SUCCESS: Highlight applied via pattern matching!')
            break
          } else {
            console.log('🚨 WARNING: HTML didn\'t change after replacement')
          }
        } else {
          console.log(`🎯🎯🎯 Pattern ${i + 1}: No matches found`)
        }
      } catch (patternError) {
        console.warn('🚨 Pattern failed:', pattern.slice(0, 20), patternError)
        continue
      }
    }

    if (!replaced) {
      console.log('🎯 Falling back to DOM range approach...')
      applyHighlightViaRangeApproach(container, highlight, plainText)
    }

  } catch (error) {
    console.warn('Text replacement approach failed:', error)
    applyHighlightViaRangeApproach(container, highlight, plainText)
  }
}

// Fallback DOM range approach (original method)
function applyHighlightViaRangeApproach(
  container: Element,
  highlight: Highlight,
  plainText: string
): void {
  const { start, end } = highlight

  // Create a fresh position mapping each time
  const mapping = createStablePositionMapping(container)

  console.log('🎯 Position mapping created:', {
    mappingLength: mapping.length,
    plainTextLength: plainText.length,
    match: mapping.length === plainText.length
  })

  // Check if mapping matches the expected plain text length
  if (mapping.length !== plainText.length) {
    console.warn(
      'Position mapping length mismatch, falling back to text replacement'
    )
    console.warn(`Mapping: ${mapping.length}, Plain text: ${plainText.length}`)
    applyHighlightViaTextReplacementSingle(
      container as HTMLElement,
      highlight,
      0
    )
    return
  }

  // Find start and end positions in DOM
  const startMap = mapping[start]
  const endMap = mapping[end - 1] // end is exclusive

  console.log('🎯 DOM mapping lookup:', {
    start, end,
    startMap: startMap ? { xpath: startMap.xpath, offset: startMap.nodeOffset } : null,
    endMap: endMap ? { xpath: endMap.xpath, offset: endMap.nodeOffset } : null
  })

  if (!startMap || !endMap) {
    console.warn('Could not find DOM positions for highlight range')
    console.warn(
      `Start: ${start}, End: ${end}, Mapping length: ${mapping.length}`
    )
    applyHighlightViaTextReplacementSingle(
      container as HTMLElement,
      highlight,
      0
    )
    return
  }

  // Handle case where highlight spans multiple text nodes
  const startNode = getNodeByXPath(startMap.xpath, container)
  const endNode = getNodeByXPath(endMap.xpath, container)

  console.log('🎯 XPath resolution:', {
    startNode: startNode ? { type: startNode.nodeType, text: startNode.textContent?.slice(0,20) } : null,
    endNode: endNode ? { type: endNode.nodeType, text: endNode.textContent?.slice(0,20) } : null,
    expectedType: Node.TEXT_NODE
  })

  if (
    !startNode ||
    !endNode ||
    startNode.nodeType !== Node.TEXT_NODE ||
    endNode.nodeType !== Node.TEXT_NODE
  ) {
    console.warn('Could not resolve XPath to text nodes')
    console.warn(`Start XPath: ${startMap.xpath}, End XPath: ${endMap.xpath}`)
    applyHighlightViaTextReplacementSingle(
      container as HTMLElement,
      highlight,
      0
    )
    return
  }

  try {
    console.log('🎯 Creating range:', {
      startOffset: startMap.nodeOffset,
      endOffset: endMap.nodeOffset + 1,
      startNodeText: startNode.textContent?.slice(0,30),
      endNodeText: endNode.textContent?.slice(0,30)
    })

    const range = document.createRange()
    range.setStart(startNode, startMap.nodeOffset)
    range.setEnd(endNode, endMap.nodeOffset + 1)

    console.log('🎯 Range created successfully, creating mark element...')

    const mark = document.createElement('mark')

    // Strong inline styles to ensure visibility across all content types
    mark.style.backgroundColor = '#fef08a !important'
    mark.style.padding = '2px 4px !important'
    mark.style.borderRadius = '4px !important'
    mark.style.cursor = 'pointer !important'
    mark.style.fontWeight = 'bold !important'
    mark.style.border = '2px solid #f59e0b !important'
    mark.style.display = 'inline !important'
    mark.style.zIndex = '999 !important'
    mark.style.boxDecorationBreak = 'clone'
    mark.style.webkitBoxDecorationBreak = 'clone'

    mark.className = 'highlight-mark bg-yellow-200 rounded px-1 cursor-pointer hover:bg-yellow-300 transition-colors'
    mark.title = 'Click to remove highlight'

    console.log('🎯 Mark element created with forced styles:', mark.style.cssText)
    mark.setAttribute('data-highlight-start', String(start))
    mark.setAttribute('data-highlight-end', String(end))
    mark.setAttribute('data-highlight-text', highlight.text)

    // Try to surround contents, fallback to manual insertion
    try {
      console.log('🎯 Attempting to surround contents with mark...')
      range.surroundContents(mark)
      console.log('✅ Successfully surrounded contents with mark!')
    } catch (error) {
      console.log('🎯 Fallback: Manually extracting and inserting contents...', error)
      const contents = range.extractContents()
      mark.appendChild(contents)
      range.insertNode(mark)
      console.log('✅ Successfully inserted mark via fallback method!')
    }
  } catch (error) {
    console.warn('Failed to create range for highlight:', error)
    // Final fallback to text replacement
    applyHighlightViaTextReplacementSingle(
      container as HTMLElement,
      highlight,
      0
    )
  }
}

// Fallback method using text replacement
function applyHighlightsViaTextReplacement(
  htmlContent: string,
  highlights: Highlight[]
): string {
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
function applyHighlightViaTextReplacementSingle(
  container: HTMLElement,
  highlight: Highlight,
  highlightIndex: number
): void {
  console.log('🎯 FALLBACK: applyHighlightViaTextReplacementSingle called:', {
    text: highlight.text?.slice(0, 50) + '...',
    highlightIndex
  })

  const textToReplace = highlight.text
  let htmlWithHighlight = container.innerHTML

  // Try multiple replacement strategies for better text matching
  const strategies = [
    // Strategy 1: Exact text match
    () => {
      const escapedText = textToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escapedText})`, 'g')
      return htmlWithHighlight.replace(regex, (match, p1) => {
        return createHighlightMarkup(p1, highlight, highlightIndex)
      })
    },

    // Strategy 2: Handle line breaks and indentation
    () => {
      // Replace line breaks and indentation with flexible HTML patterns
      const flexibleText = textToReplace
        .replace(/\n\s+/g, '\\s*(?:</p>\\s*<p[^>]*>|<br[^>]*>)\\s*')
        .replace(/\n/g, '\\s*(?:</p>\\s*<p[^>]*>|<br[^>]*>|</div>\\s*<div[^>]*>)\\s*')
        .replace(/\s+/g, '\\s+')

      const regex = new RegExp(`(${flexibleText})`, 'gi')
      return htmlWithHighlight.replace(regex, (match) => {
        return createHighlightMarkup(match, highlight, highlightIndex)
      })
    },

    // Strategy 3: Split and highlight parts across HTML elements
    () => {
      const words = textToReplace.trim().split(/\s+/)
      if (words.length < 2) return htmlWithHighlight

      let result = htmlWithHighlight
      let allFound = true

      for (const word of words) {
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (!result.includes(word)) {
          allFound = false
          break
        }
      }

      if (allFound) {
        // Create a regex that matches the words with any HTML in between
        const wordPattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(?:[\\s\\S]*?)')
        const regex = new RegExp(`(${wordPattern})`, 'gi')
        return result.replace(regex, (match) => {
          return createHighlightMarkup(match, highlight, highlightIndex)
        })
      }

      return result
    }
  ]

  // Try each strategy in order
  for (const strategy of strategies) {
    try {
      const result = strategy()
      if (result !== htmlWithHighlight) {
        console.log('✅ Highlight applied successfully via fallback strategy')
        container.innerHTML = result
        return
      }
    } catch (error) {
      console.warn('Strategy failed:', error)
      continue
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('All fallback strategies failed for text:', textToReplace.slice(0, 50))
  }
}

// Helper to create consistent highlight markup
function createHighlightMarkup(content: string, highlight: Highlight, highlightIndex: number): string {
  return `<mark class="highlight-mark bg-yellow-200 rounded px-1 cursor-pointer hover:bg-yellow-300 transition-colors"
           style="background-color: #fef08a !important;
                  padding: 2px 4px !important;
                  border-radius: 4px !important;
                  cursor: pointer !important;
                  font-weight: bold !important;
                  border: 2px solid #f59e0b !important;
                  display: inline !important;
                  z-index: 999 !important;
                  box-decoration-break: clone !important;
                  -webkit-box-decoration-break: clone !important;
                  line-height: inherit !important;"
           title="Click to remove highlight"
           data-highlight-start="${highlight.start}"
           data-highlight-end="${highlight.end}"
           data-highlight-text="${highlight.text.replace(/"/g, '&quot;')}"
           data-highlight-index="${highlightIndex}">${content}</mark>`
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
          const exact = highlights.find(
            (h) => h.start === start && h.end === end && h.text === text
          )
          if (exact) {
            onRemoveHighlight(exact)
            return
          }

          // Fallback: find by position only
          const byPosition = highlights.find(
            (h) => h.start === start && h.end === end
          )
          if (byPosition) {
            onRemoveHighlight(byPosition)
            return
          }
        }

        // Final fallback: find by text content
        const textContent = target.textContent || ''
        const byText = highlights.find((h) => h.text === textContent)
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
  // Debug logging for highlighting issues
  if (process.env.NODE_ENV === 'development' && highlights && highlights.length > 0) {
    console.log('HighlightedTextRenderer:', {
      isHtml,
      textLength: text.length,
      textPreview: text.substring(0, 100),
      highlights: highlights.map(h => ({
        start: h.start,
        end: h.end,
        text: h.text,
        length: h.text.length
      }))
    })
  }

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
      return renderHtmlWithClickHandler(
        highlightedHtml,
        highlights,
        onRemoveHighlight
      )
    } catch (error) {
      console.error(
        'Failed to apply HTML highlights, falling back to original content:',
        error
      )
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
