'use client';
import { renderTextWithFormattingAndMath } from './question-display';

interface Highlight { 
  start: number; 
  end: number; 
  text: string; 
}

interface Props {
  text: string;
  highlights: Highlight[];
  onRemoveHighlight?: (highlight: Highlight) => void;
}

export function HighlightedTextRenderer({ text, highlights, onRemoveHighlight }: Props) {
  if (!highlights || highlights.length === 0) {
    return <>{renderTextWithFormattingAndMath(text)}</>;
  }

  const parts = [];
  let lastIndex = 0;

  // Sort highlights by start position to ensure proper rendering order
  const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);

  sortedHighlights.forEach((h, i) => {
    // Text before the highlight
    if (h.start > lastIndex) {
      const beforeText = text.substring(lastIndex, h.start);
      parts.push(
        <span key={`text-${i}`}>
          {renderTextWithFormattingAndMath(beforeText)}
        </span>
      );
    }
    
    // The highlighted text
    const highlightedText = text.substring(h.start, h.end);
    parts.push(
      <mark 
        key={`mark-${i}`} 
        className="bg-yellow-200 rounded px-1 cursor-pointer hover:bg-yellow-300 transition-colors"
        title="Click to remove highlight"
        onClick={() => onRemoveHighlight?.(h)}
      >
        {renderTextWithFormattingAndMath(highlightedText)}
      </mark>
    );
    
    lastIndex = h.end;
  });

  // Text after the last highlight
  if (lastIndex < text.length) {
    const afterText = text.substring(lastIndex);
    parts.push(
      <span key="text-last">
        {renderTextWithFormattingAndMath(afterText)}
      </span>
    );
  }

  return <>{parts}</>;
}