'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface ContentRendererProps {
  htmlContent: string;
}

export function ContentRenderer({ htmlContent }: ContentRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      // Find all our custom math spans
      const mathElements = contentRef.current.querySelectorAll('span[data-math]');
      mathElements.forEach((el) => {
        const element = el as HTMLElement;
        const latex = element.dataset.math || '';
        const isInline = element.dataset.inline === 'true';

        // Render KaTeX into the element
        try {
          katex.render(latex, element, {
            throwOnError: false,
            displayMode: !isInline,
          });
        } catch (e) {
          console.error('KaTeX render error:', e);
          element.textContent = `[KaTeX Error: ${latex}]`;
        }
      });
    }
  }, [htmlContent]); // Re-run whenever the HTML content changes

  return (
    <div
      ref={contentRef}
      className="prose max-w-none"
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}