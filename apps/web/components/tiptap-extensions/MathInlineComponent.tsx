// apps/web/components/tiptap-extensions/MathInlineComponent.tsx
'use client'
import { NodeViewWrapper } from '@tiptap/react'
import { InlineMath } from 'react-katex'
import 'katex/dist/katex.min.css'

export const MathInlineComponent = (props: any) => {
  const latex = props.node.attrs['data-math']
  // The `selected` prop is automatically passed by Tiptap
  const { selected } = props

  return (
    <NodeViewWrapper
      as="span"
      className={`math-inline bg-purple-100 px-1 rounded text-purple-800
                  ${selected ? 'ring-2 ring-blue-500' : ''}`}
    >
      <InlineMath math={latex} />
    </NodeViewWrapper>
  )
}
