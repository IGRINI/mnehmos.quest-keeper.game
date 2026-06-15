import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { CodexProvider } from './CodexProvider';

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

describe('CodexProvider', () => {
    beforeEach(() => {
        vi.mocked(invoke).mockResolvedValue({ content: 'ok', toolCalls: [] });
    });

    it('normalizes OpenAI-style tool calls before invoking the Tauri Codex adapter', async () => {
        const provider = new CodexProvider();

        await provider.sendMessage(
            [
                {
                    role: 'assistant',
                    content: '',
                    toolCalls: [
                        {
                            id: 'call_1',
                            type: 'function',
                            function: {
                                name: 'list_characters',
                                arguments: '{"limit":5}',
                            },
                        } as any,
                    ],
                },
                {
                    role: 'tool',
                    content: 'No characters found in the database.',
                    toolCallId: 'call_1',
                },
            ],
            '',
            'codex-auto-review',
            []
        );

        expect(invoke).toHaveBeenCalledWith('codex_send_message', {
            request: {
                model: 'codex-auto-review',
                messages: [
                    {
                        role: 'assistant',
                        content: '',
                        toolCalls: [
                            {
                                id: 'call_1',
                                name: 'list_characters',
                                arguments: '{"limit":5}',
                            },
                        ],
                    },
                    {
                        role: 'tool',
                        content: 'No characters found in the database.',
                        toolCallId: 'call_1',
                    },
                ],
                tools: [],
            },
        });
    });
});
