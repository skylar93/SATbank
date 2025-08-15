'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bold, Italic, Underline, Search, Replace, Superscript, Subscript, Undo, Redo, AlignCenter, Table, AlignLeft, AlignRight, Image } from 'lucide-react'
import { InlineMath, BlockMath } from 'react-katex'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
  showPreview?: boolean
  compact?: boolean // For smaller interface like answer choices
  tableData?: any // For displaying Supabase table data
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter text...",
  rows = 6,
  className = "",
  showPreview = false,
  compact = false,
  tableData
}: RichTextEditorProps) {
  const [selectedText, setSelectedText] = useState('')
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [currentMatch, setCurrentMatch] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [showTableEditor, setShowTableEditor] = useState(false)
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [tableRows, setTableRows] = useState(2)
  const [tableCols, setTableCols] = useState(2)
  const [showVisualTableEditor, setShowVisualTableEditor] = useState(false)
  const [editableTableData, setEditableTableData] = useState<{headers: string[], rows: string[][]} | null>(null)
  
  // Undo/Redo functionality
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [isUndoRedo, setIsUndoRedo] = useState(false)
  const [lastValue, setLastValue] = useState(value)

  // Math symbols and common LaTeX expressions
  const mathSymbols = [
    { symbol: '²', latex: '^2', name: 'Squared' },
    { symbol: '³', latex: '^3', name: 'Cubed' },
    { symbol: '√', latex: '\\sqrt{}', name: 'Square root' },
    { symbol: '∛', latex: '\\sqrt[3]{}', name: 'Cube root' },
    { symbol: '∞', latex: '\\infty', name: 'Infinity' },
    { symbol: 'π', latex: '\\pi', name: 'Pi' },
    { symbol: '±', latex: '\\pm', name: 'Plus minus' },
    { symbol: '≤', latex: '\\leq', name: 'Less than or equal' },
    { symbol: '≥', latex: '\\geq', name: 'Greater than or equal' },
    { symbol: '≠', latex: '\\neq', name: 'Not equal' },
    { symbol: '°', latex: '^\\circ', name: 'Degree' },
    { symbol: 'α', latex: '\\alpha', name: 'Alpha' },
    { symbol: 'β', latex: '\\beta', name: 'Beta' },
    { symbol: 'θ', latex: '\\theta', name: 'Theta' },
  ]

  const commonFractions = [
    { display: '1/2', latex: '\\frac{1}{2}' },
    { display: '1/3', latex: '\\frac{1}{3}' },
    { display: '2/3', latex: '\\frac{2}{3}' },
    { display: '1/4', latex: '\\frac{1}{4}' },
    { display: '3/4', latex: '\\frac{3}{4}' },
    { display: 'a/b', latex: '\\frac{a}{b}' },
  ]

  useEffect(() => {
    if (findText) {
      const matches = value.toLowerCase().split(findText.toLowerCase()).length - 1
      setTotalMatches(matches)
      setCurrentMatch(matches > 0 ? 1 : 0)
    } else {
      setTotalMatches(0)
      setCurrentMatch(0)
    }
  }, [findText, value])

  // Initialize editable table data when tableData changes
  useEffect(() => {
    if (tableData && tableData.headers && tableData.rows) {
      setEditableTableData({
        headers: [...tableData.headers],
        rows: tableData.rows.map((row: string[]) => [...row])
      })
    } else {
      setEditableTableData(null)
    }
  }, [tableData])

  // Initialize history with first value
  useEffect(() => {
    if (history.length === 0) {
      setHistory([value])
      setHistoryIndex(0)
      setLastValue(value)
    }
  }, [])

  // Add to history when value changes (but not during undo/redo operations)
  useEffect(() => {
    if (isUndoRedo) {
      // Skip history updates during undo/redo
      setIsUndoRedo(false)
      setLastValue(value)
      return
    }

    // Only add to history if value actually changed from the last recorded value
    if (value !== lastValue && history.length > 0) {
      // Remove any history after current index (if we were in the middle of history)
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push(value)
      
      // Keep history reasonable size
      if (newHistory.length > 50) {
        newHistory.shift()
        setHistoryIndex(newHistory.length - 1)
      } else {
        setHistoryIndex(newHistory.length - 1)
      }
      
      setHistory(newHistory)
      setLastValue(value)
    }
  }, [value])


  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && history.length > 0) {
      const newIndex = historyIndex - 1
      const undoValue = history[newIndex]
      
      setIsUndoRedo(true)
      setHistoryIndex(newIndex)
      onChange(undoValue)
    }
  }, [historyIndex, history, onChange])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      const redoValue = history[newIndex]
      
      setIsUndoRedo(true)
      setHistoryIndex(newIndex)
      onChange(redoValue)
    }
  }, [historyIndex, history, onChange])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target === textareaRef.current) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          handleUndo()
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
          e.preventDefault()
          handleRedo()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  const handleTextSelection = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart
      const end = textareaRef.current.selectionEnd
      const selected = value.substring(start, end)
      setSelectedText(selected)
    }
  }

  const insertFormat = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return

    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    const selectedText = value.substring(start, end)
    
    const newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end)
    onChange(newText)

    // Restore cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newStart = start + prefix.length
        const newEnd = newStart + selectedText.length
        textareaRef.current.setSelectionRange(newStart, newEnd)
        textareaRef.current.focus()
      }
    }, 0)
  }

  const insertMath = (latexExpression: string) => {
    if (!textareaRef.current) return

    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    
    const mathText = `$${latexExpression}$`
    const newText = value.substring(0, start) + mathText + value.substring(end)
    onChange(newText)

    // Position cursor after the inserted math
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = start + mathText.length
        textareaRef.current.setSelectionRange(newPosition, newPosition)
        textareaRef.current.focus()
      }
    }, 0)
  }

  const insertFraction = (latexFraction: string) => {
    insertMath(latexFraction)
  }

  const insertTable = (rows: number, cols: number) => {
    if (!textareaRef.current) return

    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    
    // Create table in markdown-like syntax that can be parsed
    const headers = Array(cols).fill('Header').map((h, i) => `${h} ${i + 1}`).join(' | ')
    const separator = Array(cols).fill('---').join(' | ')
    const tableRows = Array(rows).fill(null).map((_, rowIndex) => 
      Array(cols).fill('Cell').map((c, colIndex) => `${c} ${rowIndex + 1}-${colIndex + 1}`).join(' | ')
    ).join('\n')
    
    const tableText = `\n{{table}}\n${headers}\n${separator}\n${tableRows}\n{{/table}}\n`
    
    const newText = value.substring(0, start) + tableText + value.substring(end)
    onChange(newText)

    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = start + tableText.length
        textareaRef.current.setSelectionRange(newPosition, newPosition)
        textareaRef.current.focus()
      }
    }, 0)

    setShowTableEditor(false)
  }

  // Update table in text
  const updateTableInText = (tableData: {headers: string[], rows: string[][]}) => {
    const headers = tableData.headers.join(' | ')
    const separator = Array(tableData.headers.length).fill('---').join(' | ')
    const rows = tableData.rows.map(row => row.join(' | ')).join('\n')
    
    const newTableText = `{{table}}\n${headers}\n${separator}\n${rows}\n{{/table}}`
    
    // Replace existing table in text
    const tableRegex = /{{table}}[\s\S]*?{{\/table}}/
    const newText = value.replace(tableRegex, newTableText)
    onChange(newText)
  }

  // Add/remove rows and columns
  const addTableRow = () => {
    if (editableTableData) {
      const newRow = Array(editableTableData.headers.length).fill('')
      const updatedData = {
        ...editableTableData,
        rows: [...editableTableData.rows, newRow]
      }
      setEditableTableData(updatedData)
      updateTableInText(updatedData)
    }
  }

  const removeTableRow = (rowIndex: number) => {
    if (editableTableData && editableTableData.rows.length > 1) {
      const updatedData = {
        ...editableTableData,
        rows: editableTableData.rows.filter((_, i) => i !== rowIndex)
      }
      setEditableTableData(updatedData)
      updateTableInText(updatedData)
    }
  }

  const addTableColumn = () => {
    if (editableTableData) {
      const updatedData = {
        headers: [...editableTableData.headers, 'New Header'],
        rows: editableTableData.rows.map(row => [...row, ''])
      }
      setEditableTableData(updatedData)
      updateTableInText(updatedData)
    }
  }

  const removeTableColumn = (colIndex: number) => {
    if (editableTableData && editableTableData.headers.length > 1) {
      const updatedData = {
        headers: editableTableData.headers.filter((_, i) => i !== colIndex),
        rows: editableTableData.rows.map(row => row.filter((_, i) => i !== colIndex))
      }
      setEditableTableData(updatedData)
      updateTableInText(updatedData)
    }
  }

  const updateTableCell = (rowIndex: number, colIndex: number, newValue: string, isHeader = false) => {
    if (editableTableData) {
      const updatedData = { ...editableTableData }
      if (isHeader) {
        updatedData.headers[colIndex] = newValue
      } else {
        updatedData.rows[rowIndex][colIndex] = newValue
      }
      setEditableTableData(updatedData)
      updateTableInText(updatedData)
    }
  }

  const handleFind = (direction: 'next' | 'prev') => {
    if (!findText || !textareaRef.current) return

    const text = value.toLowerCase()
    const searchText = findText.toLowerCase()
    let index = -1

    if (direction === 'next') {
      index = text.indexOf(searchText, textareaRef.current.selectionStart + 1)
      if (index === -1) {
        index = text.indexOf(searchText, 0) // Wrap around
      }
    } else {
      const currentPos = textareaRef.current.selectionStart
      index = text.lastIndexOf(searchText, currentPos - 1)
      if (index === -1) {
        index = text.lastIndexOf(searchText) // Wrap around to end
      }
    }

    if (index !== -1) {
      textareaRef.current.setSelectionRange(index, index + findText.length)
      textareaRef.current.focus()
    }
  }

  const handleReplace = () => {
    if (!findText || !textareaRef.current) return

    const start = textareaRef.current.selectionStart
    const end = textareaRef.current.selectionEnd
    const selectedText = value.substring(start, end)

    if (selectedText.toLowerCase() === findText.toLowerCase()) {
      const newText = value.substring(0, start) + replaceText + value.substring(end)
      onChange(newText)
      
      // Move to next occurrence
      setTimeout(() => handleFind('next'), 0)
    }
  }

  const handleReplaceAll = () => {
    if (!findText) return
    
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const newText = value.replace(regex, replaceText)
    onChange(newText)
    setShowFindReplace(false)
  }

  const renderPreview = (text: string, tableData?: any) => {
    if (!text) return text;
    
    const parts = [];
    let lastIndex = 0;
    
    // If we have table_data, render it first
    if (tableData && tableData.headers && tableData.rows) {
      parts.push(
        <div key="table-data" className="my-4 overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 bg-white">
            <thead>
              <tr className="bg-gray-50">
                {tableData.headers.map((header: string, i: number) => (
                  <th key={i} className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.rows.map((row: string[], i: number) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {row.map((cell: string, j: number) => (
                    <td key={j} className="border border-gray-300 px-4 py-2 text-gray-900">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    
    // Combined regex for tables, positioned images, regular images, math expressions, formatting, line breaks, dashes, long blanks, and center alignment
    const combinedRegex = /({{table}}[\s\S]*?{{\/table}}|{{img-(left|center|right)}}!\[(.*?)\]\((.*?)\){{\/img-(left|center|right)}}|!\[(.*?)\]\((.*?)\)|_{5,}|\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|::(.*?)::|\*\*(.*?)\*\*|\*(.*?)\*|__([^_]*?)__|_([^_]*?)_|\^\^(.*?)\^\^|\~\~(.*?)\~\~|---|--|\\n|\n)/g;
    let match: RegExpExecArray | null;
    
    while ((match = combinedRegex.exec(text)) !== null) {
      // Add text before current match
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push(
            <span key={`text-${lastIndex}`}>
              {textBefore}
            </span>
          );
        }
      }
      
      const matchedContent = match[1];
      
      // Handle tables
      if (matchedContent.startsWith('{{table}}')) {
        const tableContent = matchedContent.replace(/{{table}}|{{\/table}}/g, '').trim();
        const lines = tableContent.split('\n').filter(line => line.trim());
        
        if (lines.length >= 3) {
          const headers = lines[0].split('|').map(h => h.trim());
          const rows = lines.slice(2).map(line => line.split('|').map(cell => cell.trim()));
          
          parts.push(
            <div key={`table-${match.index}`} className="my-4 overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 bg-white">
                <thead>
                  <tr className="bg-gray-50">
                    {headers.map((header, i) => (
                      <th key={i} className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {row.map((cell, j) => (
                        <td key={j} className="border border-gray-300 px-4 py-2 text-gray-900">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
      }
      // Handle positioned images
      else if (match[2] && match[3] && match[4]) {
        const position = match[2];
        const alt = match[3];
        const url = match[4];
        
        const alignmentClass = position === 'left' ? 'text-left' : 
                              position === 'right' ? 'text-right' : 'text-center';
        
        parts.push(
          <div key={`positioned-image-${match.index}`} className={`my-4 ${alignmentClass}`}>
            <img 
              src={url} 
              alt={alt}
              className="max-w-full h-auto border border-gray-200 rounded inline-block"
              onError={(e) => {
                console.error('Image failed to load:', url);
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        );
      }
      // Handle regular markdown images ![alt](url)
      else if (match[6] !== undefined && match[7] !== undefined) {
        const imageUrl = match[7];
        const imageAlt = match[6];
        parts.push(
          <div key={`image-${match.index}`} className="my-4 text-center">
            <img 
              src={imageUrl} 
              alt={imageAlt}
              className="max-w-full h-auto border border-gray-200 rounded inline-block"
              onError={(e) => {
                console.error('Image failed to load:', imageUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        );
      }
      // Handle long blanks (5 or more underscores) - MUST BE FIRST
      else if (matchedContent.match(/_{5,}/)) {
        const blankLength = matchedContent.length;
        parts.push(
          <span 
            key={`blank-${match.index}`} 
            style={{ 
              display: 'inline-block',
              width: `${Math.max(blankLength * 0.8, 3)}em`,
              minWidth: '3em',
              borderBottom: '1px solid #374151',
              height: '1.2em',
              marginBottom: '1px'
            }}
          >
            &nbsp;
          </span>
        );
      }
      // Handle center alignment ::text::
      else if (match[8] !== undefined) {
        parts.push(
          <div key={`center-${match.index}`} className="text-center my-2">
            {renderPreview(match[8])}
          </div>
        );
      }
      // Handle math expressions
      else if (matchedContent.startsWith('$')) {
        const isBlock = matchedContent.startsWith('$$');
        const cleanMath = matchedContent.replace(/^\$+|\$+$/g, '').trim();
        
        try {
          if (isBlock) {
            parts.push(
              <div key={`math-${match.index}`} className="my-2">
                <BlockMath math={cleanMath} />
              </div>
            );
          } else {
            parts.push(
              <InlineMath key={`math-${match.index}`} math={cleanMath} />
            );
          }
        } catch (error) {
          console.error('KaTeX render error:', error);
          parts.push(
            <span key={`fallback-${match.index}`} className="bg-red-100 px-1 rounded text-red-800">
              ${cleanMath}$
            </span>
          );
        }
      }
      // Handle bold formatting **text**
      else if (match[9] !== undefined) {
        parts.push(
          <strong key={`bold-${match.index}`} className="font-bold">
            {match[9]}
          </strong>
        );
      }
      // Handle italic formatting *text*
      else if (match[10] !== undefined) {
        parts.push(
          <em key={`italic-${match.index}`} className="italic">
            {match[10]}
          </em>
        );
      }
      // Handle underline formatting __text__
      else if (match[11] !== undefined) {
        parts.push(
          <span key={`underline-${match.index}`} className="underline">
            {match[11]}
          </span>
        );
      }
      // Handle italic formatting _text_
      else if (match[12] !== undefined) {
        parts.push(
          <em key={`italic2-${match.index}`} className="italic">
            {match[12]}
          </em>
        );
      }
      // Handle superscript formatting ^^text^^
      else if (match[13] !== undefined) {
        parts.push(
          <sup key={`superscript-${match.index}`} className="text-sm">
            {match[13]}
          </sup>
        );
      }
      // Handle subscript formatting ~~text~~
      else if (match[14] !== undefined) {
        parts.push(
          <sub key={`subscript-${match.index}`} className="text-sm">
            {match[14]}
          </sub>
        );
      }
      // Handle dashes --- and --
      else if (matchedContent === '---' || matchedContent === '--') {
        parts.push(
          <span key={`dash-${match.index}`} className="mx-1">
            —
          </span>
        );
      }
      // Handle line breaks \n and literal \n
      else if (matchedContent === '\n' || matchedContent === '\\n') {
        parts.push(
          <br key={`br-${match.index}`} />
        );
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      if (remainingText) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {remainingText}
          </span>
        );
      }
    }
    
    // If no formatting was found, return the original text
    if (parts.length === 0) {
      return text;
    }
    
    return <>{parts}</>;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Formatting Toolbar */}
      <div className={`flex flex-wrap items-center gap-2 ${compact ? 'p-2' : 'p-3'} bg-gray-50 border border-gray-300 rounded-t-md`}>
        {/* Undo/Redo */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex === 0}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo size={compact ? 14 : 16} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndex === history.length - 1}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <Redo size={compact ? 14 : 16} />
          </button>
        </div>

        {/* Text Formatting */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            type="button"
            onClick={() => insertFormat('**', '**')}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="Bold (**text**)"
          >
            <Bold size={compact ? 14 : 16} />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('*', '*')}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="Italic (*text*)"
          >
            <Italic size={compact ? 14 : 16} />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('__', '__')}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="Underline (__text__)"
          >
            <Underline size={compact ? 14 : 16} />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('^^', '^^')}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="Superscript (^^text^^)"
          >
            <Superscript size={compact ? 14 : 16} />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('~~', '~~')}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="Subscript (~~text~~)"
          >
            <Subscript size={compact ? 14 : 16} />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('::', '::')}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="Center align (::text::)"
          >
            <AlignCenter size={compact ? 14 : 16} />
          </button>
        </div>

        {/* Special Characters */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            type="button"
            onClick={() => insertFormat('---')}
            className="px-2 py-1 text-sm hover:bg-gray-200 rounded transition-colors"
            title="Em dash (---)"
          >
            —
          </button>
          <button
            type="button"
            onClick={() => insertFormat('_______')}
            className="px-2 py-1 text-sm hover:bg-gray-200 rounded transition-colors"
            title="Long blank (_______)"
          >
            ___
          </button>
          {!compact && (
            <button
              type="button"
              onClick={() => onChange(value + '\n')}
              className="px-2 py-1 text-sm hover:bg-gray-200 rounded transition-colors"
              title="Line break"
            >
              ↵
            </button>
          )}
        </div>

        {/* Math Symbols */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          {mathSymbols.slice(0, compact ? 5 : 6).map((item) => (
            <button
              key={item.latex}
              type="button"
              onClick={() => insertMath(item.latex)}
              className="px-2 py-1 text-sm hover:bg-gray-200 rounded transition-colors"
              title={`${item.name} (${item.latex})`}
            >
              {item.symbol}
            </button>
          ))}
        </div>

        {/* Common Fractions */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          {commonFractions.slice(0, compact ? 2 : 3).map((frac) => (
            <button
              key={frac.latex}
              type="button"
              onClick={() => insertFraction(frac.latex)}
              className="px-2 py-1 text-sm hover:bg-gray-200 rounded transition-colors"
              title={`Insert ${frac.display}`}
            >
              {frac.display}
            </button>
          ))}
        </div>

        {/* Table and Image Tools */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            type="button"
            onClick={() => setShowTableEditor(!showTableEditor)}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="Insert Table"
          >
            <Table size={compact ? 14 : 16} />
          </button>
          <button
            type="button"
            onClick={() => setShowImageUpload(!showImageUpload)}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title="Insert Image"
          >
            <Image size={compact ? 14 : 16} />
          </button>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-1">
          {!compact && (
            <button
              type="button"
              onClick={() => setShowFindReplace(!showFindReplace)}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title="Find & Replace"
            >
              <Search size={16} />
            </button>
          )}
          {showPreview && (
            <button
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className={`px-2 py-1 text-sm rounded transition-colors ${
                previewMode ? 'bg-blue-200 text-blue-800' : 'hover:bg-gray-200'
              }`}
            >
              Preview
            </button>
          )}
        </div>
      </div>

      {/* Find & Replace Panel */}
      {showFindReplace && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Find:</label>
              <input
                type="text"
                value={findText}
                onChange={(e) => setFindText(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Search text..."
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Replace:</label>
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Replace with..."
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleFind('prev')}
                className="px-2 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                disabled={totalMatches === 0}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => handleFind('next')}
                className="px-2 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                disabled={totalMatches === 0}
              >
                ↓
              </button>
              <span className="text-sm text-gray-600 mx-2">
                {totalMatches > 0 ? `${currentMatch}/${totalMatches}` : '0/0'}
              </span>
              <button
                type="button"
                onClick={handleReplace}
                className="px-2 py-1 text-sm bg-blue-200 hover:bg-blue-300 rounded"
                disabled={totalMatches === 0}
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleReplaceAll}
                className="px-2 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
                disabled={totalMatches === 0}
              >
                Replace All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Upload Panel */}
      {showImageUpload && (
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1">
              <label className="text-sm font-medium">Image URL:</label>
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const input = e.target as HTMLInputElement
                    if (input.value.trim()) {
                      insertFormat(`![Image](${input.value.trim()})`)
                      input.value = ''
                      setShowImageUpload(false)
                    }
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling?.querySelector('input') as HTMLInputElement
                  if (input?.value.trim()) {
                    insertFormat(`![Image](${input.value.trim()})`)
                    input.value = ''
                    setShowImageUpload(false)
                  }
                }}
                className="px-3 py-1 text-sm bg-green-500 text-white hover:bg-green-600 rounded"
              >
                Insert Image
              </button>
              <button
                type="button"
                onClick={() => setShowImageUpload(false)}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Editor Panel */}
      {showTableEditor && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Rows:</label>
              <input
                type="number"
                min="1"
                max="10"
                value={tableRows}
                onChange={(e) => setTableRows(parseInt(e.target.value) || 2)}
                className="px-2 py-1 border border-gray-300 rounded text-sm w-16"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Columns:</label>
              <input
                type="number"
                min="1"
                max="10"
                value={tableCols}
                onChange={(e) => setTableCols(parseInt(e.target.value) || 2)}
                className="px-2 py-1 border border-gray-300 rounded text-sm w-16"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => insertTable(tableRows, tableCols)}
                className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
              >
                Insert Table
              </button>
              <button
                type="button"
                onClick={() => setShowTableEditor(false)}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Editor/Preview Area */}
      {previewMode && showPreview ? (
        <div className="p-3 border border-gray-300 rounded-b-md bg-white min-h-[150px]">
          <div className="text-gray-900 leading-relaxed">
            {renderPreview(value, tableData)}
          </div>
        </div>
      ) : (
        <div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onSelect={handleTextSelection}
            placeholder={placeholder}
            rows={rows}
            className={`w-full p-3 border border-gray-300 rounded-b-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${className}`}
          />
          {/* Visual Table Editor */}
          {editableTableData && editableTableData.headers && editableTableData.rows && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-700">Table Editor:</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowVisualTableEditor(!showVisualTableEditor)}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    {showVisualTableEditor ? 'Hide Editor' : 'Edit Table'}
                  </button>
                  {showVisualTableEditor && (
                    <>
                      <button
                        type="button"
                        onClick={addTableRow}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                      >
                        + Row
                      </button>
                      <button
                        type="button"
                        onClick={addTableColumn}
                        className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                      >
                        + Col
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                {showVisualTableEditor ? (
                  <table className="w-full border-collapse border border-gray-300 bg-white">
                    <thead>
                      <tr className="bg-blue-50">
                        {editableTableData.headers.map((header, i) => (
                          <th key={i} className="border border-gray-300 p-1 relative group">
                            <input
                              type="text"
                              value={header}
                              onChange={(e) => updateTableCell(-1, i, e.target.value, true)}
                              className="w-full px-2 py-1 text-sm font-semibold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                              placeholder={`Header ${i + 1}`}
                            />
                            {editableTableData.headers.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeTableColumn(i)}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                title="Remove column"
                              >
                                ×
                              </button>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {editableTableData.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {row.map((cell, colIndex) => (
                            <td key={colIndex} className="border border-gray-300 p-1 relative group">
                              <input
                                type="text"
                                value={cell}
                                onChange={(e) => updateTableCell(rowIndex, colIndex, e.target.value)}
                                className="w-full px-2 py-1 text-sm text-gray-900 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                                placeholder={`Cell ${rowIndex + 1}-${colIndex + 1}`}
                              />
                              {colIndex === 0 && editableTableData.rows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeTableRow(rowIndex)}
                                  className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                  title="Remove row"
                                >
                                  ×
                                </button>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full border-collapse border border-gray-300 bg-white">
                    <thead>
                      <tr className="bg-gray-50">
                        {editableTableData.headers.map((header, i) => (
                          <th key={i} className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {editableTableData.rows.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          {row.map((cell, j) => (
                            <td key={j} className="border border-gray-300 px-4 py-2 text-gray-900">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}