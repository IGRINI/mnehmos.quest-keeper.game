import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { LLMProviderInterface, ChatMessage, LLMResponse } from '../types';
import { LLMProvider } from '../../../stores/settingsStore';

const CODEX_STREAM_DELTA_EVENT = 'codex-response-delta';

interface CodexWireMessage {
    role: ChatMessage['role'];
    content: string;
    toolCalls?: CodexWireToolCall[];
    toolCallId?: string;
}

interface CodexWireToolCall {
    id?: string;
    name: string;
    arguments: any;
}

interface CodexWireTool {
    type: 'function';
    name: string;
    description?: string;
    parameters: any;
    strict: boolean;
}

interface CodexStreamDeltaPayload {
    streamId: string;
    delta: string;
}

export class CodexProvider implements LLMProviderInterface {
    provider: LLMProvider = 'codex';

    async sendMessage(
        messages: ChatMessage[],
        _apiKey: string,
        model: string,
        tools?: any[],
        streamEventId?: string
    ): Promise<LLMResponse> {
        const response = await invoke<LLMResponse>('codex_send_message', {
            request: {
                model,
                messages: this.toCodexMessages(messages),
                tools: (tools || []).map(this.toCodexTool),
                ...(streamEventId ? { streamEventId } : {}),
            },
        });

        return {
            content: response.content || '',
            toolCalls: response.toolCalls || [],
        };
    }

    async streamMessage(
        messages: ChatMessage[],
        apiKey: string,
        model: string,
        tools: any[] | undefined,
        onChunk: (content: string) => void,
        onToolCalls: (toolCalls: any[]) => void,
        onComplete: () => void | Promise<void>,
        onError: (error: string) => void
    ): Promise<void> {
        const streamEventId = this.createStreamEventId();
        let unlisten: UnlistenFn | null = null;
        let streamedContent = '';

        try {
            unlisten = await listen<CodexStreamDeltaPayload>(
                CODEX_STREAM_DELTA_EVENT,
                (event) => {
                    if (event.payload.streamId !== streamEventId) {
                        return;
                    }

                    streamedContent += event.payload.delta;
                    onChunk(event.payload.delta);
                }
            );

            const response = await this.sendMessage(messages, apiKey, model, tools, streamEventId);
            if (response.content) {
                const missingSuffix = this.getMissingSuffix(streamedContent, response.content);
                if (missingSuffix) {
                    onChunk(missingSuffix);
                }
            }
            if (response.toolCalls && response.toolCalls.length > 0) {
                onToolCalls(response.toolCalls);
            }
            await onComplete();
        } catch (error: unknown) {
            onError(this.formatError(error));
        } finally {
            unlisten?.();
        }
    }

    private formatError(error: unknown): string {
        if (typeof error === 'string') {
            return error;
        }

        if (error instanceof Error && error.message) {
            return error.message;
        }

        if (error && typeof error === 'object' && 'message' in error) {
            const message = (error as { message?: unknown }).message;
            if (typeof message === 'string' && message.trim().length > 0) {
                return message;
            }
        }

        return 'Запрос Codex не выполнен';
    }

    private toCodexTool(tool: any): CodexWireTool {
        return {
            type: 'function',
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema || tool.parameters || {},
            strict: false,
        };
    }

    private toCodexMessages(messages: ChatMessage[]): CodexWireMessage[] {
        return messages.map((message) => {
            const wireMessage: CodexWireMessage = {
                role: message.role,
                content: message.content || '',
            };

            if (message.toolCallId) {
                wireMessage.toolCallId = message.toolCallId;
            }

            const toolCalls = (message.toolCalls || [])
                .map((toolCall) => this.toCodexToolCall(toolCall))
                .filter((toolCall): toolCall is CodexWireToolCall => toolCall !== null);

            if (toolCalls.length > 0) {
                wireMessage.toolCalls = toolCalls;
            }

            return wireMessage;
        });
    }

    private toCodexToolCall(toolCall: any): CodexWireToolCall | null {
        const name = toolCall.name || toolCall.function?.name;
        if (typeof name !== 'string' || name.trim().length === 0) {
            return null;
        }

        return {
            id: typeof toolCall.id === 'string' ? toolCall.id : undefined,
            name,
            arguments: toolCall.arguments ?? toolCall.function?.arguments ?? {},
        };
    }

    private createStreamEventId(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    private getMissingSuffix(streamedContent: string, finalContent: string): string {
        if (!finalContent) {
            return '';
        }

        if (!streamedContent) {
            return finalContent;
        }

        if (finalContent.startsWith(streamedContent)) {
            return finalContent.slice(streamedContent.length);
        }

        return '';
    }
}
