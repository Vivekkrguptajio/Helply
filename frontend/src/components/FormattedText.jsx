import React from 'react';

// Renders **bold** and `code` inside a line. Unclosed markers (mid-stream) stay as plain text.
function renderInline(text) {
    return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return <code key={i} className="px-1 py-0.5 rounded bg-black/30 text-[0.9em] font-mono">{part.slice(1, -1)}</code>;
        }
        return part;
    });
}

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

function Lines({ text }) {
    const lines = text.split('\n').filter((l) => l.trim() !== '');
    return lines.map((line, i) =>
        BULLET.test(line) ? (
            <div key={i} className="flex gap-2">
                <span className="text-indigo-200 select-none">•</span>
                <span className="flex-1">{renderInline(line.replace(BULLET, ''))}</span>
            </div>
        ) : (
            <div key={i}>{renderInline(line)}</div>
        )
    );
}

// Lightweight markdown for AI answers: fenced code blocks, bullet / numbered lists, bold, inline code.
export function FormattedText({ text }) {
    // Splitting on ``` puts code at the odd indexes (an unclosed fence mid-stream counts as code)
    const parts = text.split('```');
    return (
        <div className="flex flex-col gap-1.5">
            {parts.map((part, i) => {
                if (i % 2 === 0) return <Lines key={i} text={part} />;
                const body = part.replace(/^[\w+#-]*\n/, ''); // drop the language tag line
                return (
                    <pre key={i} className="my-1 p-3 rounded-lg bg-black/40 text-[0.85em] leading-snug font-mono overflow-x-auto whitespace-pre">
                        {body.replace(/\n$/, '')}
                    </pre>
                );
            })}
        </div>
    );
}
