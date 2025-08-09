'use client'

import dynamic from 'next/dynamic'
import { useState, useMemo } from 'react'

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })
import 'react-quill/dist/quill.snow.css'

interface WysiwygEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: number
  className?: string
  compact?: boolean
}

export function WysiwygEditor({
  value,
  onChange,
  placeholder = "Enter text...",
  height = 150,
  className = "",
  compact = false
}: WysiwygEditorProps) {
  const [editorValue, setEditorValue] = useState(value || '')

  // Custom toolbar configuration
  const modules = useMemo(() => ({
    toolbar: compact ? {
      container: [
        ['bold', 'italic', 'underline'],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        ['clean']
      ]
    } : {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'align': [] }],
        [{ 'color': [] }, { 'background': [] }],
        ['link', 'image'],
        ['formula'],
        ['clean']
      ]
    }
  }), [compact])

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'script',
    'list', 'bullet',
    'align',
    'color', 'background',
    'link', 'image',
    'formula'
  ]

  const handleChange = (content: string) => {
    setEditorValue(content)
    onChange(content)
  }

  return (
    <div className={`${className}`}>
      <style jsx global>{`
        .ql-editor {
          min-height: ${height}px;
          font-size: 14px;
          line-height: 1.5;
        }
        .ql-toolbar {
          border-top: 1px solid #d1d5db;
          border-left: 1px solid #d1d5db;
          border-right: 1px solid #d1d5db;
          border-radius: 6px 6px 0 0;
          background: #f9fafb;
        }
        .ql-container {
          border-bottom: 1px solid #d1d5db;
          border-left: 1px solid #d1d5db;
          border-right: 1px solid #d1d5db;
          border-radius: 0 0 6px 6px;
          background: white;
        }
        .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: italic;
        }
        .ql-editor:focus {
          outline: none;
        }
        .ql-container:focus-within {
          border-color: #f97316;
          box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2);
        }
        ${compact ? `
          .ql-toolbar {
            padding: 4px 8px;
          }
          .ql-toolbar .ql-formats {
            margin-right: 8px;
          }
          .ql-editor {
            padding: 8px;
          }
        ` : ''}
      `}</style>
      
      <ReactQuill
        value={editorValue}
        onChange={handleChange}
        placeholder={placeholder}
        modules={modules}
        formats={formats}
        theme="snow"
      />
    </div>
  )
}