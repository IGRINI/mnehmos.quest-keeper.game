import React, { useState } from 'react';

interface CensorBlockProps {
    content: string;
    renderMarkdown: (markdown: string) => React.ReactNode;
}

/**
 * Spoiler/censor wrapper that hides content until the user clicks to reveal it.
 * Intended for tool responses that include `[censor]...[/censor]` tags from the LLM.
 */
export const CensorBlock: React.FC<CensorBlockProps> = ({ content, renderMarkdown }) => {
    const [revealed, setRevealed] = useState(false);

    return (
        <div className="border border-terminal-amber/60 bg-terminal-black/70 rounded p-3">
            <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wider text-terminal-amber">
                <div className="flex items-center gap-2">
                    <span className="codicon codicon-eye-closed" />
                    <span>Спойлер (пометка LLM)</span>
                </div>
                <button
                    type="button"
                    onClick={() => setRevealed(!revealed)}
                    className="px-2 py-1 border border-terminal-amber/60 rounded text-terminal-amber hover:bg-terminal-amber/10 transition-colors"
                >
                    {revealed ? 'Скрыть' : 'Показать'}
                </button>
            </div>
            {revealed ? (
                <div className="mt-2 markdown-content prose prose-invert prose-sm max-w-none">
                    {renderMarkdown(content)}
                </div>
            ) : (
                <div className="mt-2 text-terminal-green/60 text-sm italic select-none">
                    Спойлер скрыт. Нажми «Показать», чтобы открыть.
                </div>
            )}
        </div>
    );
};
