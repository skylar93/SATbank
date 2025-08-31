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

// Helper function to insert math into editor
export function insertMath(editor: any, math: string, inline: boolean = true) {
  const rendered = renderMathToHTML(math, inline)
  const className = inline 
    ? 'math-inline bg-purple-100 px-1 rounded text-purple-800' 
    : 'math-block bg-purple-100 px-2 py-1 rounded text-purple-800 block my-2'
  
  // Create a proper HTML structure that won't be escaped
  const mathHTML = `<span class="${className}" data-math="${math}" data-inline="${inline}" contenteditable="false">${rendered}</span>`
  
  // Insert HTML content properly without escaping
  editor.chain().focus().insertContent(mathHTML).run()
}