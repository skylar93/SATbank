'use client'

// Shared utilities for consistent text processing across highlighting components

// Check if a text node is visible in the rendered DOM
export function isVisibleTextNode(n: Node): n is Text {
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

// Create a consistent tree walker for visible text nodes
export function getTextWalker(root: Node) {
  return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return isVisibleTextNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    }
  })
}

// Get visible plain text consistently across components
export function getVisiblePlainText(container: Element): string {
  const walker = getTextWalker(container)
  let text = ''
  while (walker.nextNode()) {
    text += (walker.currentNode as Text).data
  }
  return text
}

// Sanitize HTML container by removing non-visible elements
export function sanitizeHtmlContainer(div: HTMLDivElement): void {
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
}

// Create a normalized container for consistent text extraction
export function createNormalizedContainer(htmlContent: string): {
  container: HTMLDivElement
  plainText: string
} {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent

  // Append off-screen so computed styles match the live DOM
  tempDiv.style.position = 'absolute'
  tempDiv.style.left = '-9999px'
  tempDiv.style.top = '-9999px'
  tempDiv.style.pointerEvents = 'none'
  tempDiv.style.opacity = '0'
  tempDiv.style.zIndex = '-1'

  const { body } = document
  if (!body) {
    throw new Error('Document body not available')
  }

  body.appendChild(tempDiv)

  try {
    // Sanitize to remove non-visible content
    sanitizeHtmlContainer(tempDiv)

    // Get normalized plain text
    const plainText = getVisiblePlainText(tempDiv)

    return { container: tempDiv, plainText }
  } catch (error) {
    tempDiv.remove()
    throw error
  }
}

// Position mapping interface
export interface PositionMap {
  plaintextIndex: number
  domNode: Node
  nodeOffset: number
  xpath: string
}

// XPath utilities for stable DOM positioning
export function getNodeXPath(node: Node, container: Element): string {
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

export function getNodeByXPath(xpath: string, container: Element): Node | null {
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

// Create stable position mapping using XPath
export function createStablePositionMapping(container: Element): PositionMap[] {
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

// Flexible text matching that handles whitespace differences
export function findFlexibleWhitespaceMatch(source: string, target: string) {
  if (!target) return null

  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const flexiblePattern = escaped.replace(/\s+/g, '\\s+')

  try {
    const regex = new RegExp(flexiblePattern, 'mu')
    const match = regex.exec(source)
    if (match?.index !== undefined) {
      return {
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      }
    }
  } catch (error) {
    console.warn('Flexible whitespace match failed:', error)
  }

  return null
}

export interface Highlight {
  start: number
  end: number
  text: string
}

// Enhanced text matching for cross-element selections
export function findBestTextMatch(
  sourceText: string,
  targetText: string,
  context: { before?: string; after?: string } = {}
): { start: number; end: number; text: string } | null {
  if (!targetText || !sourceText) return null

  const cleanTarget = targetText.trim()
  if (!cleanTarget) return null

  // Try exact match first
  let index = sourceText.indexOf(cleanTarget)
  if (index >= 0) {
    return {
      start: index,
      end: index + cleanTarget.length,
      text: cleanTarget
    }
  }

  // Try normalized whitespace match
  const flexibleMatch = findFlexibleWhitespaceMatch(sourceText, cleanTarget)
  if (flexibleMatch) return flexibleMatch

  // Try contextual matching if we have context
  if (context.before || context.after) {
    const contextualMatch = findContextualMatch(sourceText, cleanTarget, context)
    if (contextualMatch) return contextualMatch
  }

  // Try partial matching for cross-element selections
  const partialMatch = findPartialMatch(sourceText, cleanTarget)
  if (partialMatch) return partialMatch

  return null
}

// Find text using surrounding context
function findContextualMatch(
  sourceText: string,
  targetText: string,
  context: { before?: string; after?: string }
): { start: number; end: number; text: string } | null {
  try {
    let searchArea = sourceText

    // If we have before context, find where it ends
    if (context.before) {
      const beforeClean = context.before.trim().slice(-50) // Last 50 chars for performance
      const beforeIndex = sourceText.lastIndexOf(beforeClean)
      if (beforeIndex >= 0) {
        searchArea = sourceText.slice(beforeIndex + beforeClean.length)
      }
    }

    // If we have after context, find where it starts
    if (context.after) {
      const afterClean = context.after.trim().slice(0, 50) // First 50 chars
      const afterIndex = searchArea.indexOf(afterClean)
      if (afterIndex >= 0) {
        searchArea = searchArea.slice(0, afterIndex)
      }
    }

    // Look for target in the narrowed search area
    const match = findFlexibleWhitespaceMatch(searchArea, targetText)
    if (match) {
      // Adjust offsets back to full source text
      const searchStart = sourceText.length - searchArea.length
      return {
        start: searchStart + match.start,
        end: searchStart + match.end,
        text: match.text
      }
    }
  } catch (error) {
    console.warn('Contextual matching failed:', error)
  }

  return null
}

// Find partial matches for text that spans multiple elements
function findPartialMatch(
  sourceText: string,
  targetText: string
): { start: number; end: number; text: string } | null {
  try {
    const words = targetText.trim().split(/\s+/)
    if (words.length < 2) return null

    // Try to find the beginning and end separately
    const firstWords = words.slice(0, Math.ceil(words.length / 2)).join(' ')
    const lastWords = words.slice(Math.floor(words.length / 2)).join(' ')

    const firstMatch = findFlexibleWhitespaceMatch(sourceText, firstWords)
    if (!firstMatch) return null

    // Look for the last words starting from first match end
    const remainingText = sourceText.slice(firstMatch.end)
    const lastMatch = findFlexibleWhitespaceMatch(remainingText, lastWords)

    if (lastMatch) {
      const fullStart = firstMatch.start
      const fullEnd = firstMatch.end + lastMatch.end
      const fullText = sourceText.slice(fullStart, fullEnd)

      return {
        start: fullStart,
        end: fullEnd,
        text: fullText
      }
    }
  } catch (error) {
    console.warn('Partial matching failed:', error)
  }

  return null
}

// Debug utilities for troubleshooting highlight issues
export function debugHighlightIssue(
  container: Element,
  highlight: Highlight,
  normalizedText: string,
  context: string = 'unknown'
): void {
  if (process.env.NODE_ENV !== 'development') return

  console.group(`🔍 Highlight Debug [${context}]`)
  console.log('Container HTML:', container.innerHTML)
  console.log('Normalized text length:', normalizedText.length)
  console.log('Normalized text preview:', normalizedText.substring(0, 200))
  console.log('Highlight:', highlight)
  console.log('Expected text at range:', normalizedText.substring(highlight.start, highlight.end))

  // Check for common issues
  if (highlight.start >= normalizedText.length) {
    console.warn('❌ Start position is beyond text length!')
  }
  if (highlight.end > normalizedText.length) {
    console.warn('❌ End position is beyond text length!')
  }
  if (highlight.start >= highlight.end) {
    console.warn('❌ Invalid range: start >= end')
  }

  const expectedText = normalizedText.substring(highlight.start, highlight.end)
  const normalizeSpace = (s: string) => s.replace(/\s+/g, ' ').trim()

  if (normalizeSpace(expectedText) !== normalizeSpace(highlight.text)) {
    console.warn('❌ Text mismatch!')
    console.log('Expected (normalized):', normalizeSpace(highlight.text))
    console.log('Found (normalized):', normalizeSpace(expectedText))
  }

  console.groupEnd()
}