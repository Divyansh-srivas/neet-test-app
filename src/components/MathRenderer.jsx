import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * Normalizes LaTeX expressions in text content.
 * Handles single-dollar inline math ($...$), double-dollar block math ($$...$$),
 * and automatically wraps un-delimited LaTeX commands (\vec, \frac, \hat, etc.)
 */
function normalizeMathText(text) {
  if (text === null || text === undefined) return '';
  let str = typeof text === 'string' ? text : String(text);

  // Replace literal '\n' string escapes if present
  str = str.replace(/\\n/g, '\n');

  // If text has LaTeX math commands but lacks '$' delimiters, auto-wrap standalone LaTeX
  if (!str.includes('$')) {
    // Match common LaTeX macros like \vec{v}, \hat{i}, \frac{a}{b}, \sqrt{x}, \alpha, \theta, etc.
    str = str.replace(/(\\vec\{[^}]+\}|\\hat\{[^}]+\}|\\frac\{[^}]+\}\{[^}]+\}|\\sqrt\{[^}]+\}|\\int_{?[^}]*}?|\\sum_{?[^}]*}?|\\alpha|\\beta|\\gamma|\\delta|\\theta|\\pi|\\omega|\\Delta|\\lambda|\\mu|\\sigma|\\pm|\\times|\\div)/g, (match) => `$${match}$`);
  }

  return str;
}

export default function MathRenderer({ content, className = '', style = {} }) {
  if (content === null || content === undefined) return null;

  const normalized = normalizeMathText(content);

  return (
    <span className={`math-rendered-block ${className}`} style={{ display: 'inline', ...style }}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Render paragraph as span to keep math inline without unwanted paragraph margins
          p: ({ node, children, ...props }) => <span {...props}>{children}</span>,
          // Render text inline
          div: ({ node, children, ...props }) => <span {...props}>{children}</span>
        }}
      >
        {normalized}
      </ReactMarkdown>
    </span>
  );
}
