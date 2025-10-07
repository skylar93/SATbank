'use client'

import React from 'react'
import { Highlighter, Trash2, BookMarked, Loader2 } from 'lucide-react'

interface HighlightToolbarProps {
  isHighlightMode: boolean
  onToggleMode: () => void
  onClearAll?: () => void
  highlightCount?: number
  disabled?: boolean
  canAddToVocab?: boolean
  onAddToVocab?: () => void
  isAddingToVocab?: boolean
  selectedSnippet?: string
}

export function HighlightToolbar({
  isHighlightMode,
  onToggleMode,
  onClearAll,
  highlightCount = 0,
  disabled = false,
  canAddToVocab = false,
  onAddToVocab,
  isAddingToVocab = false,
  selectedSnippet,
}: HighlightToolbarProps) {
  return (
    <div className="flex items-center space-x-2">
      {/* Highlight Mode Toggle Button */}
      <button
        onClick={onToggleMode}
        disabled={disabled}
        className={`
          flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
          ${
            isHighlightMode
              ? 'bg-yellow-100 text-yellow-800 border border-yellow-300 shadow-sm'
              : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
          }
          ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-1'
          }
        `}
        title={`${isHighlightMode ? 'Exit' : 'Enter'} highlight mode`}
        aria-label={`${isHighlightMode ? 'Exit' : 'Enter'} highlight mode`}
        aria-pressed={isHighlightMode}
      >
        <Highlighter
          size={16}
          className={isHighlightMode ? 'text-yellow-600' : 'text-gray-500'}
        />
        {isHighlightMode && (
          <div className="w-2 h-2 bg-yellow-500 rounded-full" />
        )}
      </button>

      {/* Add to vocab button */}
      <button
        onClick={onAddToVocab}
        disabled={disabled || !canAddToVocab || isAddingToVocab || !onAddToVocab}
        className={`
          flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm transition-all duration-200
          ${
            canAddToVocab && !disabled
              ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
              : 'bg-gray-100 text-gray-400 border border-gray-200'
          }
          ${
            disabled || !canAddToVocab
              ? 'cursor-not-allowed opacity-60'
              : 'hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1'
          }
        `}
        title={
          canAddToVocab
            ? 'Add selected text to vocabulary'
            : 'Select text to add to vocabulary'
        }
        aria-label="Add selected text to vocabulary"
      >
        {isAddingToVocab ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <BookMarked size={16} />
        )}
        {selectedSnippet && (
          <span className="max-w-[12rem] truncate text-xs text-gray-600">
            {selectedSnippet}
          </span>
        )}
      </button>

      {/* Clear All Highlights Button */}
      {highlightCount > 0 && onClearAll && (
        <button
          onClick={onClearAll}
          disabled={disabled}
          className={`
            flex items-center space-x-1 px-2 py-1.5 rounded-md text-sm transition-all duration-200
            text-red-600 bg-red-50 border border-red-200 hover:bg-red-100
            ${
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1'
            }
          `}
          title={`Clear all ${highlightCount} highlights`}
          aria-label={`Clear all ${highlightCount} highlights`}
        >
          <Trash2 size={14} />
          <span>{highlightCount}</span>
        </button>
      )}
    </div>
  )
}
