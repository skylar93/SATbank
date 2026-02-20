'use client'

import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface ContentRendererProps {
  htmlContent: string
  className?: string
}

export function ContentRenderer({
  htmlContent,
  className,
}: ContentRendererProps) {
  const processedHtml = useMemo(() => {
    if (!htmlContent) return ''

    // Create a temporary DOM element to process the HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent

    // Find all math elements and render them
    const mathElements = tempDiv.querySelectorAll('span[data-math]')
    mathElements.forEach((el) => {
      const element = el as HTMLElement
      const latex = element.dataset.math || ''
      const isInline = element.dataset.inline === 'true'

      try {
        // Render KaTeX and get the HTML
        const rendered = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: !isInline,
        })
        element.innerHTML = rendered

        // Remove the data attributes since we've processed them
        element.removeAttribute('data-math')
        element.removeAttribute('data-inline')
      } catch (e) {
        console.error('KaTeX render error:', e)
        element.textContent = `[KaTeX Error: ${latex}]`
      }
    })

    return tempDiv.innerHTML
  }, [htmlContent])

  const combinedClassName = useMemo(() => {
    const baseClass = 'prose max-w-none'
    return className ? `${baseClass} ${className}` : baseClass
  }, [className])

  return (
    <div
      className={combinedClassName}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
    />
  )
}
