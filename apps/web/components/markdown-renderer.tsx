'use client'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({
  content,
  className = '',
}: MarkdownRendererProps) {
  // Convert markdown to HTML
  const convertMarkdownToHtml = (markdown: string) => {
    if (!markdown) return ''

    // Handle literal \n\n strings directly - split on them to create paragraphs
    const processedMarkdown = markdown

    // If we have literal \n\n, split on them to create separate paragraphs
    const paragraphs = processedMarkdown.split(/\\n\\n/)

    const result = paragraphs
      .map((paragraph) => {
        if (!paragraph.trim()) return ''

        // Apply formatting to each paragraph
        const formattedParagraph = paragraph
          .trim()
          // Convert any remaining literal \n to <br>
          .replace(/\\n/g, '<br>')
          // Handle formatting
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/__(.*?)__/g, '<u>$1</u>') // Use <u> tag for underline
          .replace(/_(.*?)_/g, '<em>$1</em>')
          .replace(/\^\^(.*?)\^\^/g, '<sup>$1</sup>')
          .replace(/~~(.*?)~~/g, '<sub>$1</sub>')
          .replace(/---/g, '—')

        return `<p>${formattedParagraph}</p>`
      })
      .filter((p) => p)

    // Join paragraphs with spacing
    return result.join('<p><br></p>')
  }

  const htmlContent = convertMarkdownToHtml(content)

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  )
}
