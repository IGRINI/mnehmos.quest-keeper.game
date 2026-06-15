import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CodexProvider } from './CodexProvider';

const eventMock = vi.hoisted(() => ({
    handler: null as null | ((event: { payload: { streamId: string; delta: string } }) => void),
    unlisten: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
    listen: vi.fn(async (_eventName, handler) => {
        eventMock.handler = handler;
        return eventMock.unlisten;
    }),
}));

describe('CodexProvider', () => {
    beforeEach(() => {
        eventMock.handler = null;
        eventMock.unlisten.mockClear();
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

    it('streams Codex SSE deltas through Tauri events without duplicating final content', async () => {
        vi.mocked(invoke).mockImplementation(async (_command, args: any) => {
            const streamId = args.request.streamEventId;

            eventMock.handler?.({ payload: { streamId, delta: 'Hel' } });
            eventMock.handler?.({ payload: { streamId: 'other-stream', delta: 'ignored' } });
            eventMock.handler?.({ payload: { streamId, delta: 'lo' } });

            return { content: 'Hello', toolCalls: [] };
        });

        const provider = new CodexProvider();
        const chunks: string[] = [];
        const onComplete = vi.fn();
        const onError = vi.fn();

        await provider.streamMessage(
            [{ role: 'user', content: 'Say hello' }],
            '',
            'codex-auto-review',
            [],
            (chunk) => chunks.push(chunk),
            vi.fn(),
            onComplete,
            onError
        );

        expect(listen).toHaveBeenCalledWith('codex-response-delta', expect.any(Function));
        expect(chunks).toEqual(['Hel', 'lo']);
        expect(onComplete).toHaveBeenCalledOnce();
        expect(onError).not.toHaveBeenCalled();
        expect(eventMock.unlisten).toHaveBeenCalledOnce();
    });
});
