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
    <div className="flex items-center gap-1.5">
      {/* Highlight Mode Toggle — circle icon button */}
      <button
        onClick={onToggleMode}
        disabled={disabled}
        className={`
          w-8 h-8 rounded-full flex items-center justify-center border-2
          transition-all duration-150 shrink-0
          ${
            isHighlightMode
              ? 'bg-yellow-400 border-yellow-400 text-white shadow-sm'
              : 'bg-transparent border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600'
          }
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'focus:outline-none'}
        `}
        title={`${isHighlightMode ? 'Exit' : 'Enter'} highlight mode`}
        aria-label={`${isHighlightMode ? 'Exit' : 'Enter'} highlight mode`}
        aria-pressed={isHighlightMode}
      >
        <Highlighter size={14} />
      </button>

      {/* Add to vocab — circle icon button */}
      <button
        onClick={onAddToVocab}
        disabled={disabled || !canAddToVocab || isAddingToVocab || !onAddToVocab}
        className={`
          w-8 h-8 rounded-full flex items-center justify-center border-2
          transition-all duration-150 shrink-0
          ${
            canAddToVocab && !disabled
              ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
              : 'bg-transparent border-gray-200 text-gray-300'
          }
          ${disabled || !canAddToVocab ? 'cursor-not-allowed' : 'focus:outline-none'}
        `}
        title={
          canAddToVocab
            ? selectedSnippet
              ? `Add "${selectedSnippet}" to vocabulary`
              : 'Add selected text to vocabulary'
            : 'Select text to add to vocabulary'
        }
        aria-label="Add selected text to vocabulary"
      >
        {isAddingToVocab ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <BookMarked size={14} />
        )}
      </button>

      {/* Clear All Highlights — circle icon button with count badge */}
      {highlightCount > 0 && onClearAll && (
        <div className="relative shrink-0">
          <button
            onClick={onClearAll}
            disabled={disabled}
            className={`
              w-8 h-8 rounded-full flex items-center justify-center border-2
              transition-all duration-150
              border-red-200 text-red-400 hover:bg-red-50 hover:border-red-300
              ${disabled ? 'opacity-40 cursor-not-allowed' : 'focus:outline-none'}
            `}
            title={`Clear all ${highlightCount} highlights`}
            aria-label={`Clear all ${highlightCount} highlights`}
          >
            <Trash2 size={14} />
          </button>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 rounded-full text-white text-[10px] flex items-center justify-center font-bold leading-none pointer-events-none">
            {highlightCount}
          </span>
        </div>
      )}
    </div>
  )
}
