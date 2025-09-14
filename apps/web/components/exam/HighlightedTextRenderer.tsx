'use client'
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
}

// Create position mapping from HTML to plaintext
function createPositionMapping(container: Element): PositionMap[] {
  const mapping: PositionMap[] = []
  let plaintextIndex = 0
  
  function walkTextNodes(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent || ''
      for (let i = 0; i < textContent.length; i++) {
        mapping.push({
          plaintextIndex: plaintextIndex,
          domNode: node,
          nodeOffset: i
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

// Apply highlights to HTML using position mapping
function applyHighlightsToHTML(htmlContent: string, highlights: Highlight[]): string {
  if (!highlights || highlights.length === 0) return htmlContent
  
  // Debug: uncomment for troubleshooting
  // console.log('Applying highlights to HTML:', {
  //   htmlLength: htmlContent.length,
  //   highlights: highlights.map(h => ({ start: h.start, end: h.end, text: h.text.substring(0, 20) }))
  // })
  
  // Create a temporary container
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent
  
  // Get the plaintext that will be used for offset calculations
  const plainText = tempDiv.textContent || tempDiv.innerText || ''
  
  // Create position mapping
  const mapping = createPositionMapping(tempDiv)
  
  // Sort highlights by start position (reverse order for safe insertion)
  const sortedHighlights = [...highlights].sort((a, b) => b.start - a.start)
  
  sortedHighlights.forEach((highlight, highlightIndex) => {
    
    const startMap = mapping[highlight.start]
    const endMap = mapping[highlight.end - 1] // end is exclusive
    
    if (!startMap || !endMap) {
      console.warn('Could not find DOM position for highlight:', highlight)
      return
    }
    
    try {
      // Create a range for the highlight
      const range = document.createRange()
      range.setStart(startMap.domNode, startMap.nodeOffset)
      range.setEnd(endMap.domNode, endMap.nodeOffset + 1)
      
      // Verify the range text matches (debug only)
      const rangeText = range.toString()
      if (rangeText !== highlight.text && process.env.NODE_ENV === 'development') {
        console.warn('Range text mismatch:', { expected: highlight.text, range: rangeText })
      }
      
      // Create mark element
      const mark = document.createElement('mark')
      mark.className = 'bg-yellow-200 rounded px-1 cursor-pointer hover:bg-yellow-300 transition-colors'
      mark.title = 'Click to remove highlight'
      mark.setAttribute('data-highlight-text', highlight.text)
      mark.setAttribute('data-highlight-index', highlightIndex.toString())
      
      // Use insertNode instead of surroundContents for complex selections
      try {
        // First try surroundContents for simple cases
        range.surroundContents(mark)
      } catch (surroundError) {
        // Alternative approach: extract contents, wrap in mark, then insert
        const contents = range.extractContents()
        mark.appendChild(contents)
        range.insertNode(mark)
      }
    } catch (error) {
      console.warn('Failed to apply highlight using range:', error, highlight)
      // Enhanced fallback: try to find and replace the text more accurately
      const textToReplace = highlight.text
      const escapedText = textToReplace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      
      // Try to find the exact position in the HTML where this text occurs
      let htmlWithHighlight = tempDiv.innerHTML
      
      // Simple text replacement as fallback
      const regex = new RegExp(`(${escapedText})`, 'g')
      let matchCount = 0
      htmlWithHighlight = htmlWithHighlight.replace(regex, (match, p1) => {
        matchCount++
        return `<mark class="bg-yellow-200 rounded px-1 cursor-pointer hover:bg-yellow-300 transition-colors" 
                 title="Click to remove highlight" 
                 data-highlight-text="${textToReplace}" 
                 data-highlight-index="${highlightIndex}">${p1}</mark>`
      })
      
      if (matchCount > 0) {
        tempDiv.innerHTML = htmlWithHighlight
      } else if (process.env.NODE_ENV === 'development') {
        console.error('Failed to apply highlight - text not found:', textToReplace)
      }
    }
  })
  
  return tempDiv.innerHTML
}

// Helper function to escape text for regex
function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Helper function to render HTML with click handler
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
        // Get the highlighted text from the data attribute
        const highlightedText = target.getAttribute('data-highlight-text')
        const highlightIndex = target.getAttribute('data-highlight-index')
        
        // Find the matching highlight by text content (more reliable than index due to sorting)
        const highlight = highlights.find(h => h.text === highlightedText)
        if (highlight) {
          onRemoveHighlight(highlight)
        } else if (process.env.NODE_ENV === 'development') {
          console.warn('Could not find matching highlight for:', highlightedText)
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
