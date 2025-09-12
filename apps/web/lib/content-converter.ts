import { marked } from 'marked'
import TurndownService from 'turndown'

// Configure marked with custom options for consistent rendering
marked.setOptions({
  breaks: true, // Convert line breaks to <br> tags
  gfm: true, // Enable GitHub Flavored Markdown
})

// Configure TurndownService with custom options
const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
})

// Add custom rules for better conversion
turndownService.addRule('preserveLineBreaks', {
  filter: 'br',
  replacement: () => '\n\n',
})

/**
 * Converts markdown text to HTML
 * @param markdown - The markdown content to convert
 * @returns HTML string
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || markdown.trim() === '') {
    return '<p></p>'
  }

  try {
    const html = marked.parse(markdown)
    return typeof html === 'string' ? html : html.toString()
  } catch (error) {
    console.error('Error converting markdown to HTML:', error)
    return `<p>Error converting content: ${markdown}</p>`
  }
}

/**
 * Converts HTML to markdown text
 * @param html - The HTML content to convert
 * @returns Markdown string
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html.trim() === '' || html.trim() === '<p></p>') {
    return ''
  }

  try {
    return turndownService.turndown(html)
  } catch (error) {
    console.error('Error converting HTML to markdown:', error)
    return `Error converting content: ${html}`
  }
}

/**
 * Sanitizes content by removing empty paragraphs and extra whitespace
 * @param content - The content to sanitize
 * @returns Sanitized content
 */
export function sanitizeContent(content: string): string {
  return content
    .replace(/<p><\/p>/g, '') // Remove empty paragraphs
    .replace(/^\s+|\s+$/g, '') // Trim whitespace
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
}

/**
 * Determines if HTML content is effectively empty
 * @param html - HTML content to check
 * @returns true if content is empty or only contains empty tags
 */
export function isEmptyHtml(html: string): boolean {
  if (!html || html.trim() === '') return true

  // Remove all HTML tags and check if any text remains
  const textContent = html.replace(/<[^>]*>/g, '').trim()
  return textContent === ''
}

/**
 * Determines if markdown content is effectively empty
 * @param markdown - Markdown content to check
 * @returns true if content is empty
 */
export function isEmptyMarkdown(markdown: string): boolean {
  return !markdown || markdown.trim() === ''
}
