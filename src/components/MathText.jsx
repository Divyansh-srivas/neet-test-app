import React from 'react';
import { InlineMath } from 'react-katex';

/**
 * Renders a single line of text that may contain $...$ or $$...$$ math spans.
 *
 * Root-cause note: Gemini (and the source PDFs) sometimes emit $$...$$ (display
 * math notation) for block-level equations. The old split regex /(\$[^$]+\$)/g
 * failed on $$...$$ because it found the inner $...$ match starting at index 1,
 * leaving a dangling bare "$" at both ends that rendered as literal dollar signs.
 *
 * Fix: use a two-pass regex that matches $$...$$ FIRST (higher priority),
 * then $...$. Both are rendered as InlineMath — we don't use BlockMath since
 * the layout is handled by the surrounding flex/block elements.
 */
function MathSegment({ text }) {
    if (!text) return null;

    // Unified pattern: $$...$$ captured first (greedy over $...$),
    // then $...$ for inline spans. Capturing group preserves delimiters in split result.
    //
    // Test cases verified by hand:
    //   "$F = A\sin Ct$"           → ["", "$F = A\sin Ct$", ""]
    //   "$$F = A\sin Ct$$"         → ["", "$$F = A\sin Ct$$", ""]
    //   "x by $$F = A\sin Ct$$"    → ["x by ", "$$F = A\sin Ct$$", ""]
    //   "the dims of $\frac{A}{B}$ and $\frac{C}{D}$" → ["the dims of ", "$\frac{A}{B}$", " and ", "$\frac{C}{D}$", ""]
    //   "$x^2 + y^2 = r^2$"        → ["", "$x^2 + y^2 = r^2$", ""]
    //   Single stray "$"           → ["$"] — no match, renders as plain text (safe)
    const MATH_RE = /(\$\$[^$]+(?:\$(?!\$)[^$]*)?\$\$|\$[^$]+\$)/g;
    const segments = text.split(MATH_RE);

    return (
        <>
            {segments.map((segment, index) => {
                // $$...$$ display math
                if (segment.startsWith('$$') && segment.endsWith('$$') && segment.length > 4) {
                    const mathString = segment.slice(2, -2).trim();
                    return (
                        <InlineMath
                            key={index}
                            math={mathString}
                            renderError={(error) => {
                                console.warn('KaTeX error (display):', error.message, 'for:', mathString);
                                return <span style={{ color: 'inherit' }}>{segment}</span>;
                            }}
                        />
                    );
                }
                // $...$ inline math
                if (segment.startsWith('$') && segment.endsWith('$') && segment.length > 2) {
                    const mathString = segment.slice(1, -1);
                    return (
                        <InlineMath
                            key={index}
                            math={mathString}
                            renderError={(error) => {
                                console.warn('KaTeX error (inline):', error.message, 'for:', mathString);
                                return <span style={{ color: 'inherit' }}>{segment}</span>;
                            }}
                        />
                    );
                }
                // Plain text (including lone stray "$" which has length 1 and fails both checks)
                return segment ? <React.Fragment key={index}>{segment}</React.Fragment> : null;
            })}
        </>
    );
}

/**
 * MathText — top-level component for rendering text that contains LaTeX math
 * AND/OR \n newline characters (Assertion-Reason, Match-the-Following, etc.).
 *
 * Strategy: split on \n first → render each line via MathSegment → join with <br />.
 */
export default function MathText({ text }) {
    if (typeof text !== 'string') {
        return <>{text}</>;
    }

    const lines = text.split('\n');

    if (lines.length === 1) {
        return <MathSegment text={text} />;
    }

    return (
        <span style={{ whiteSpace: 'pre-line' }}>
            {lines.map((line, i) => (
                <React.Fragment key={i}>
                    <MathSegment text={line} />
                    {i < lines.length - 1 && <br />}
                </React.Fragment>
            ))}
        </span>
    );
}
