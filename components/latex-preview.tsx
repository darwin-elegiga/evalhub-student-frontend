'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    MathJax?: {
      typesetPromise: (elements?: HTMLElement[]) => Promise<void>;
      startup?: {
        promise: Promise<void>;
      };
    };
  }
}

interface LatexPreviewProps {
  latex: string;
  display?: boolean;
  className?: string;
}

export function LatexPreview({ latex, display = false, className }: LatexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const typeset = async () => {
      if (containerRef.current && window.MathJax) {
        try {
          await window.MathJax.startup?.promise;
          await window.MathJax.typesetPromise([containerRef.current]);
        } catch (error) {
          console.error('MathJax typeset error:', error);
        }
      }
    };
    typeset();
  }, [latex]);

  const wrappedLatex = display ? `$$${latex}$$` : `\\(${latex}\\)`;

  return (
    <div ref={containerRef} className={className}>
      {wrappedLatex}
    </div>
  );
}

interface QuestionContentProps {
  html: string;
  className?: string;
}

export function QuestionContent({ html, className }: QuestionContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const typeset = async () => {
      if (containerRef.current && window.MathJax) {
        try {
          await window.MathJax.startup?.promise;
          await window.MathJax.typesetPromise([containerRef.current]);
        } catch (error) {
          console.error('MathJax typeset error:', error);
        }
      }
    };
    typeset();
  }, [html]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'prose prose-slate max-w-none',
        'prose-p:my-2 prose-p:leading-relaxed',
        'prose-headings:font-semibold prose-headings:text-slate-900',
        'prose-strong:font-semibold prose-strong:text-slate-900',
        'prose-code:text-sm prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded',
        'prose-pre:bg-slate-900 prose-pre:text-slate-100',
        'prose-ul:my-2 prose-ol:my-2',
        'prose-li:my-0.5',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface OptionContentProps {
  html: string;
  className?: string;
}

export function OptionContent({ html, className }: OptionContentProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  // Strip surrounding p tags for inline display
  const cleanHtml = html
    .replace(/^<p>/, '')
    .replace(/<\/p>$/, '')
    .trim();

  useEffect(() => {
    const typeset = async () => {
      if (containerRef.current && window.MathJax) {
        try {
          await window.MathJax.startup?.promise;
          await window.MathJax.typesetPromise([containerRef.current]);
        } catch (error) {
          console.error('MathJax typeset error:', error);
        }
      }
    };
    typeset();
  }, [cleanHtml]);

  return (
    <span
      ref={containerRef}
      className={cn('inline', className)}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
}
