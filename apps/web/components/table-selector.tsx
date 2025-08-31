'use client'

import { useState, useRef, useEffect } from 'react'

interface TableSelectorProps {
  onTableSelect: (rows: number, cols: number) => void
  onClose: () => void
}

export function TableSelector({ onTableSelect, onClose }: TableSelectorProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const maxRows = 10
  const maxCols = 10

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleCellHover = (row: number, col: number) => {
    setHoveredCell({ row, col })
  }

  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col })
    onTableSelect(row + 1, col + 1)
    onClose()
  }

  const isCellHighlighted = (row: number, col: number) => {
    if (!hoveredCell && !selectedCell) return false
    const target = hoveredCell || selectedCell
    if (!target) return false
    return row <= target.row && col <= target.col
  }

  const getTablePreview = () => {
    if (!hoveredCell && !selectedCell) return ''
    const target = hoveredCell || selectedCell
    if (!target) return ''
    return `${target.row + 1} × ${target.col + 1} Table`
  }

  return (
    <div 
      ref={containerRef}
      className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50"
    >
      <div className="text-sm text-gray-600 mb-2 text-center min-h-[20px]">
        {getTablePreview() || 'Select table size'}
      </div>
      
      <div className="grid grid-cols-10 gap-1 w-fit">
        {Array.from({ length: maxRows }, (_, row) =>
          Array.from({ length: maxCols }, (_, col) => (
            <div
              key={`${row}-${col}`}
              className={`
                w-4 h-4 border border-gray-300 cursor-pointer transition-colors
                ${isCellHighlighted(row, col) 
                  ? 'bg-blue-200 border-blue-400' 
                  : 'bg-white hover:bg-gray-100'
                }
              `}
              onMouseEnter={() => handleCellHover(row, col)}
              onClick={() => handleCellClick(row, col)}
              title={`${row + 1}×${col + 1}`}
            />
          ))
        )}
      </div>
      
      <div className="mt-3 text-xs text-gray-500 text-center">
        Hover and click to select table size
      </div>
    </div>
  )
}