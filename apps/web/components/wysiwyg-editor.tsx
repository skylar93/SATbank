'use client'

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Image from '@tiptap/extension-image'
import MathInline from './tiptap-extensions/MathInline'
import { 
  Bold, 
  Italic, 
  UnderlineIcon, 
  CornerDownLeft, 
  List, 
  ListOrdered, 
  Quote, 
  Minus, 
  Table as TableIcon,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sigma as MathIcon,
  Trash2
} from 'lucide-react'
import { useState } from 'react'
import { ImageUpload } from './image-upload'
import { insertMath } from './math-extension'
import { TableSelector } from './table-selector'
import { MathEditorModal } from './exam/MathEditorModal'

// Toolbar component for editor controls
const Toolbar = ({ editor }: { editor: Editor | null }) => {
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [showTableSelector, setShowTableSelector] = useState(false)
  const [isMathModalOpen, setIsMathModalOpen] = useState(false)

  if (!editor) return null

  const addImage = (imageUrl: string) => {
    editor.chain().focus().setImage({ src: imageUrl }).run()
    setShowImageUpload(false)
  }

  const insertTable = (rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
  }

  return (
    <div className="flex items-center gap-1 p-2 border-b border-gray-200 flex-wrap">
      {/* Text Formatting */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
          editor.isActive('bold') ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
        }`}
        title="Bold"
      >
        <Bold size={16} />
      </button>
      
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
          editor.isActive('italic') ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
        }`}
        title="Italic"
      >
        <Italic size={16} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
          editor.isActive('underline') ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
        }`}
        title="Underline"
      >
        <UnderlineIcon size={16} />
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Headings */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`px-2 py-1 text-sm rounded hover:bg-gray-100 transition-colors ${
          editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
        }`}
        title="Heading"
      >
        H2
      </button>

      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`px-2 py-1 text-sm rounded hover:bg-gray-100 transition-colors ${
          editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
        }`}
        title="Subheading"
      >
        H3
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Lists */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
          editor.isActive('bulletList') ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
        }`}
        title="Bullet List"
      >
        <List size={16} />
      </button>

      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
          editor.isActive('orderedList') ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
        }`}
        title="Ordered List"
      >
        <ListOrdered size={16} />
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Quote and HR */}
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
          editor.isActive('blockquote') ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
        }`}
        title="Quote"
      >
        <Quote size={16} />
      </button>

      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-600"
        title="Horizontal Rule"
      >
        <Minus size={16} />
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Table */}
      <div className="relative">
        <button
          onClick={() => setShowTableSelector(!showTableSelector)}
          className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
            showTableSelector ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
          }`}
          title="Insert Table"
        >
          <TableIcon size={16} />
        </button>
        
        {showTableSelector && (
          <TableSelector
            onTableSelect={(rows, cols) => {
              insertTable(rows, cols)
              setShowTableSelector(false)
            }}
            onClose={() => setShowTableSelector(false)}
          />
        )}
      </div>

      {/* Table Operations - Show only when table is active */}
      {editor?.isActive('table') && (
        <>
          <div className="w-px h-6 bg-red-300 mx-1" />
          <button
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="p-1.5 rounded hover:bg-red-100 transition-colors text-red-600"
            title="Delete Table"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().addRowBefore().run()}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 transition-colors text-gray-600"
            title="Add Row Above"
          >
            +R↑
          </button>
          <button
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 transition-colors text-gray-600"
            title="Add Row Below"
          >
            +R↓
          </button>
          <button
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 transition-colors text-gray-600"
            title="Add Column Left"
          >
            +C←
          </button>
          <button
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 transition-colors text-gray-600"
            title="Add Column Right"
          >
            +C→
          </button>
        </>
      )}

      {/* Image */}
      <button
        onClick={() => setShowImageUpload(true)}
        className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-600"
        title="Insert Image"
      >
        <ImageIcon size={16} />
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Text Alignment */}
      <button
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
          editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
        }`}
        title="Align Left"
      >
        <AlignLeft size={16} />
      </button>

      <button
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
          editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
        }`}
        title="Align Center"
      >
        <AlignCenter size={16} />
      </button>

      <button
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
          editor.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
        }`}
        title="Align Right"
      >
        <AlignRight size={16} />
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Math Expression */}
      <button
        onClick={() => setIsMathModalOpen(true)}
        className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-600"
        title="Insert Math Expression"
      >
        <MathIcon size={16} />
      </button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Line Break */}
      <button
        onClick={() => editor.chain().focus().setHardBreak().run()}
        className="p-1.5 rounded hover:bg-gray-100 transition-colors text-gray-600"
        title="Line Break"
      >
        <CornerDownLeft size={16} />
      </button>

      {/* Image Upload Modal */}
      {showImageUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Upload Image</h3>
            <ImageUpload 
              onUploadSuccess={addImage}
              onCancel={() => setShowImageUpload(false)}
            />
            <button
              onClick={() => setShowImageUpload(false)}
              className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Math Editor Modal */}
      <MathEditorModal
        isOpen={isMathModalOpen}
        onClose={() => setIsMathModalOpen(false)}
        onInsert={(latex, isBlock) => {
          insertMath(editor, latex, !isBlock);
          setIsMathModalOpen(false);
        }}
      />
    </div>
  )
}

interface WysiwygEditorProps {
  content: string // HTML content
  onChange: (newContent: string) => void
  placeholder?: string
  className?: string
  compact?: boolean
  rows?: number
}

export function WysiwygEditor({ 
  content, 
  onChange, 
  placeholder = "Enter text...",
  className = "",
  compact = false,
  rows = 6
}: WysiwygEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Configure heading extension to add proper classes
        heading: {
          levels: [2, 3],
          HTMLAttributes: {
            class: 'font-bold',
          },
        },
        // Configure blockquote
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-gray-300 pl-4 italic text-gray-700 my-4',
          },
        },
        // Configure lists
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc pl-6 my-4 space-y-1',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal pl-6 my-4 space-y-1',
          },
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Image.configure({
        inline: false,
        HTMLAttributes: {
          class: 'max-w-full h-auto border border-gray-200 rounded my-2',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-300 w-full my-4',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border border-gray-300',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 bg-gray-50 px-4 py-2 text-left font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 px-4 py-2',
        },
      }),
      MathInline,
    ],
    content: content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none p-3 min-h-[${rows * 1.5}rem] focus:outline-none ${compact ? 'text-sm' : ''} [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-3 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-700`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Cleanup editor on unmount
  const handleDestroy = () => {
    if (editor) {
      editor.destroy()
    }
  }

  return (
    <div className={`border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 ${className}`}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      {compact && (
        <div className="px-3 py-1 text-xs text-gray-500 border-t bg-gray-50">
          WYSIWYG Editor - Format text using the toolbar above
        </div>
      )}
    </div>
  )
}