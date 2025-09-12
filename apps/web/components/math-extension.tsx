'use client'

import katex from 'katex'

// Math rendering utility function
export function renderMathToHTML(math: string, inline: boolean = true): string {
  try {
    return katex.renderToString(math, {
      displayMode: !inline,
      throwOnError: false,
    })
  } catch (error) {
    return `<span class="text-red-600">Error: ${math}</span>`
  }
}

// Helper function to clean LaTeX input
function cleanLatex(input: string): string {
  return input.trim()
}

// Helper function to insert math into editor using custom node
export function insertMath(editor: any, math: string, inline: boolean = true) {
  if (!inline) {
    // Handle block math separately if needed in the future
    // For now, we focus on inline math
    console.log('Block math not implemented yet')
    return
  }

  const cleanMath = cleanLatex(math)

  // Insert using our custom mathInline node instead of HTML
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'mathInline',
      attrs: { 'data-math': cleanMath },
    })
    .run()
}
