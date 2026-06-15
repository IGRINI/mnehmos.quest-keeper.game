import React, { memo } from 'react';
import { SpoilerRenderer } from './Spoiler';

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
  renderMarkdown: (text: string) => React.ReactNode;
}

const MarkdownMessage = memo(({
  content,
  isStreaming,
  renderMarkdown
}: {
  content: string;
  isStreaming: boolean;
  renderMarkdown: (text: string) => React.ReactNode;
}) => {
  return (
    <div className="markdown-content streaming-markdown prose prose-invert prose-sm max-w-none">
      <SpoilerRenderer content={content} renderMarkdown={renderMarkdown} />
      {isStreaming && <span className="streaming-cursor" aria-hidden="true">▌</span>}
    </div>
  );
});

MarkdownMessage.displayName = 'MarkdownMessage';

/**
 * Optimized streaming message component.
 *
 * Streams use the same markdown pipeline as completed messages so formatting
 * appears as soon as enough syntax has arrived.
 */
export const StreamingMessage = memo(({ 
  content,
  isStreaming,
  renderMarkdown
}: StreamingMessageProps) => {
  return (
    <MarkdownMessage
      content={content}
      isStreaming={isStreaming}
      renderMarkdown={renderMarkdown}
    />
  );
});

StreamingMessage.displayName = 'StreamingMessage';

// CSS for the streaming cursor animation
export const streamingStyles = `
  .streaming-cursor {
    animation: blink 0.7s infinite;
    color: rgb(var(--text-primary));
  }
  
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  
  .streaming-markdown {
    font-family: inherit;
    line-height: 1.6;
    /* Prevent layout shifts during streaming */
    contain: content;
    /* Smooth text appearance */
    will-change: contents;
  }

  .streaming-markdown > :last-child {
    margin-bottom: 0;
  }
`;
