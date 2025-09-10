// apps/web/components/tiptap-extensions/ImageComponent.tsx
'use client'
import { NodeViewWrapper } from '@tiptap/react'

export const ImageComponent = (props: any) => {
  const { src, alt } = props.node.attrs
  const { selected } = props

  return (
    <NodeViewWrapper as="span" className="inline-block">
      <img
        src={src}
        alt={alt}
        className={`max-w-full h-auto border rounded
                    ${selected ? 'ring-2 ring-blue-500' : 'border-gray-200'}`}
      />
    </NodeViewWrapper>
  )
}
