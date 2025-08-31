'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface MathEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latex: string, isBlock: boolean) => void;
}

export function MathEditorModal({ isOpen, onClose, onInsert }: MathEditorModalProps) {
  const [latex, setLatex] = useState('');
  const [isBlock, setIsBlock] = useState(false);

  useEffect(() => {
    // Reset state when modal opens
    if (isOpen) {
      setLatex('');
      setIsBlock(false);
    }
  }, [isOpen]);

  // Simple check for block math
  useEffect(() => {
    setIsBlock(latex.trim().startsWith('$$'));
  }, [latex]);

  const cleanLatexForPreview = (input: string) => {
    let cleaned = input.trim();
    if (cleaned.startsWith('$$') && cleaned.endsWith('$$')) return cleaned.substring(2, cleaned.length - 2);
    if (cleaned.startsWith('$') && cleaned.endsWith('$')) return cleaned.substring(1, cleaned.length - 1);
    return cleaned;
  };

  const renderPreview = () => {
    if (!latex.trim()) {
      return <span className="text-gray-400">Preview will appear here</span>;
    }

    try {
      const cleanedLatex = cleanLatexForPreview(latex);
      return isBlock ? (
        <BlockMath math={cleanedLatex} />
      ) : (
        <InlineMath math={cleanedLatex} />
      );
    } catch (error) {
      return <span className="text-red-500">Invalid LaTeX syntax</span>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Math Expression Editor</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 my-4">
          <div className="space-y-2">
            <label htmlFor="latex-input" className="text-sm font-medium">Enter LaTeX:</label>
            <Textarea
              id="latex-input"
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              rows={8}
              placeholder="e.g., x^2 + y^2 = z^2"
              className="font-mono"
            />
            <div className="text-xs text-gray-500">
              Tip: Start with $$ for block math, or use $ for inline math
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Live Preview:</label>
            <div className="p-4 border rounded-md min-h-[180px] flex items-center justify-center bg-gray-50">
              {renderPreview()}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={() => onInsert(latex, isBlock)} 
            disabled={!latex.trim()}
          >
            Insert Math
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}