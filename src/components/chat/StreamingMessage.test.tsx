import React from 'react';
import { render, screen } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { describe, expect, it } from 'vitest';
import { StreamingMessage } from './StreamingMessage';

function renderMarkdown(text: string): React.ReactNode {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
}

describe('StreamingMessage', () => {
  it('renders markdown while the message is still streaming', () => {
    render(
      <StreamingMessage
        content={'**Жирный текст**\n\n- первый пункт'}
        isStreaming
        renderMarkdown={renderMarkdown}
      />
    );

    expect(screen.getByText('Жирный текст').tagName).toBe('STRONG');
    expect(screen.getByText('первый пункт').tagName).toBe('LI');
    expect(screen.getByText('▌')).toBeInTheDocument();
  });

  it('removes the streaming cursor after completion', () => {
    render(
      <StreamingMessage
        content={'## Заголовок'}
        isStreaming={false}
        renderMarkdown={renderMarkdown}
      />
    );

    expect(screen.getByRole('heading', { name: 'Заголовок' })).toBeInTheDocument();
    expect(screen.queryByText('▌')).not.toBeInTheDocument();
  });
});
