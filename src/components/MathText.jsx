import React from 'react';
import { InlineMath } from 'react-katex';

export default function MathText({ text }) {
    if (typeof text !== 'string') {
        return <>{text}</>;
    }

    // Handle edge case where Gemini outputs just an opening $ but no closing $
    let processText = text;
    if (processText.startsWith('$') && (processText.match(/\$/g) || []).length === 1) {
        processText = processText.substring(1);
    }

    // Split on $...$ patterns
    // The regex /\$([^$]+)\$/g will capture the LaTeX inside the $ $ in group 1
    const segments = processText.split(/(\$[^$]+\$)/g);

    return (
        <>
            {segments.map((segment, index) => {
                if (segment.startsWith('$') && segment.endsWith('$') && segment.length > 2) {
                    const mathString = segment.substring(1, segment.length - 1);
                    return (
                        <InlineMath
                            key={index}
                            math={mathString}
                            renderError={(error) => {
                                console.warn("KaTeX error:", error.message, "for string:", mathString);
                                return <span style={{ color: 'inherit' }}>{segment}</span>;
                            }}
                        />
                    );
                }
                
                // Return plain text segments as-is
                return <React.Fragment key={index}>{segment}</React.Fragment>;
            })}
        </>
    );
}
