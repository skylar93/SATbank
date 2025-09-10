// apps/web/components/tiptap-extensions/MathInline.ts
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MathInlineComponent } from './MathInlineComponent'

export default Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true, // This node is treated as a single, indivisible unit

  addAttributes() {
    return {
      'data-math': {
        default: '',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-math][data-inline="true"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    // This is how it will be saved in the database
    return ['span', mergeAttributes(HTMLAttributes, { 'data-inline': 'true' })]
  },

  addNodeView() {
    // This tells Tiptap to use a React component to render this node in the editor
    return ReactNodeViewRenderer(MathInlineComponent)
  },
})
