// WYSIWYG Editor Component (Simple Markdown Implementation)
// Temporarily using basic markdown approach with plain text storage
// The advanced WYSIWYG editor features will be revisited later.

// Simple Markdown Editor Component as replacement for WYSIWYG
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
  return (
    <div className={className}>
      <div className="text-xs text-gray-600 mb-1">
        Markdown Mode: **bold** *italic* __underline__ ^^superscript^^ ~~subscript~~
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ minHeight: `${height}px` }}
        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm resize-vertical"
      />
    </div>
  )
}