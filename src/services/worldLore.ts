import { getSortedNotes, useNotesStore } from '../stores/notesStore';
import type { ChatMessage } from './llm/types';

export const WORLD_LORE_SOURCE_TAG = 'world-lore-source';
export const WORLD_LORE_SUMMARY_TAG = 'world-lore-summary';
export const WORLD_LORE_CONTEXT_CHAR_LIMIT = 2400;

const LORE_CHUNK_SIZE = 8000;
const MAX_LORE_CHUNKS = 12;
const CHUNK_SUMMARY_CHAR_LIMIT = 700;
const FINAL_SUMMARY_CHAR_LIMIT = 2200;

type SendMessage = (messages: ChatMessage[]) => Promise<string>;

export interface WorldLoreSummaryResult {
  summary: string;
  sourceCharCount: number;
  usedAi: boolean;
  chunks: number;
  sampledSource: boolean;
}

interface SaveWorldLoreOptions {
  worldId: string;
  worldName: string;
  sourceLore: string;
  summary: string;
}

function normalizeLoreText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function trimToBoundary(text: string, limit: number): string {
  if (text.length <= limit) return text;

  const slice = text.slice(0, limit);
  const lastBreak = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '));
  if (lastBreak > Math.floor(limit * 0.65)) {
    return slice.slice(0, lastBreak + 1).trim();
  }
  return slice.trim();
}

function sampleLoreChunks(text: string): { chunks: string[]; sampledSource: boolean } {
  if (text.length <= LORE_CHUNK_SIZE) {
    return { chunks: [text], sampledSource: false };
  }

  const maxSequentialChars = LORE_CHUNK_SIZE * MAX_LORE_CHUNKS;
  if (text.length <= maxSequentialChars) {
    const chunks: string[] = [];
    for (let start = 0; start < text.length; start += LORE_CHUNK_SIZE) {
      chunks.push(text.slice(start, start + LORE_CHUNK_SIZE));
    }
    return { chunks, sampledSource: false };
  }

  const chunks: string[] = [];
  const maxStart = text.length - LORE_CHUNK_SIZE;
  for (let i = 0; i < MAX_LORE_CHUNKS; i++) {
    const start = Math.floor((maxStart * i) / (MAX_LORE_CHUNKS - 1));
    chunks.push(text.slice(start, start + LORE_CHUNK_SIZE));
  }
  return { chunks, sampledSource: true };
}

export function buildFallbackWorldLoreSummary(sourceLore: string): string {
  const normalized = normalizeLoreText(sourceLore);
  if (!normalized) return '';

  const excerpt = trimToBoundary(normalized, FINAL_SUMMARY_CHAR_LIMIT - 180);
  const suffix = normalized.length > excerpt.length
    ? '\n\n[Full world lore is stored in Lore Notes. This compact excerpt is the active context seed.]'
    : '';

  return `${excerpt}${suffix}`.trim();
}

async function summarizeLoreChunk(
  chunk: string,
  index: number,
  count: number,
  worldName: string,
  sendMessage: SendMessage
): Promise<string> {
  const prompt = `Summarize this world-lore chunk for long-term campaign memory.

Rules:
- Return English only.
- Do not call tools.
- Max ${CHUNK_SUMMARY_CHAR_LIMIT} characters.
- Preserve named entities, timeline facts, factions, conflicts, cosmology, hard constraints, secrets, and tone.
- Omit prose style, duplicates, and meta commentary.

World: ${worldName}
Chunk: ${index + 1}/${count}

${chunk}`;

  const response = await sendMessage([{ role: 'user', content: prompt }]);
  return trimToBoundary(response.trim(), CHUNK_SUMMARY_CHAR_LIMIT);
}

async function mergeLoreSummaries(
  summaries: string[],
  worldName: string,
  sendMessage: SendMessage
): Promise<string> {
  const prompt = `Merge these partial world-lore summaries into one canonical campaign-memory summary.

Rules:
- Return English only.
- Do not call tools.
- Max ${FINAL_SUMMARY_CHAR_LIMIT} characters.
- Use compact bullets under: Premise, History, Powers, Conflicts, Canon Constraints.
- Keep only durable facts the DM must remember every session.
- Do not include the full source text.

World: ${worldName}

${summaries.map((summary, index) => `Partial ${index + 1}:\n${summary}`).join('\n\n')}`;

  const response = await sendMessage([{ role: 'user', content: prompt }]);
  return trimToBoundary(response.trim(), FINAL_SUMMARY_CHAR_LIMIT);
}

export async function buildWorldLoreSummary(
  sourceLore: string,
  worldName: string,
  sendMessage?: SendMessage
): Promise<WorldLoreSummaryResult> {
  const normalized = normalizeLoreText(sourceLore);
  if (!normalized) {
    return {
      summary: '',
      sourceCharCount: 0,
      usedAi: false,
      chunks: 0,
      sampledSource: false,
    };
  }

  const { chunks, sampledSource } = sampleLoreChunks(normalized);

  if (!sendMessage) {
    return {
      summary: buildFallbackWorldLoreSummary(normalized),
      sourceCharCount: normalized.length,
      usedAi: false,
      chunks: chunks.length,
      sampledSource,
    };
  }

  try {
    const chunkSummaries: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      chunkSummaries.push(await summarizeLoreChunk(chunks[i], i, chunks.length, worldName, sendMessage));
    }

    const summary = chunks.length === 1
      ? trimToBoundary(chunkSummaries[0], FINAL_SUMMARY_CHAR_LIMIT)
      : await mergeLoreSummaries(chunkSummaries, worldName, sendMessage);

    return {
      summary,
      sourceCharCount: normalized.length,
      usedAi: true,
      chunks: chunks.length,
      sampledSource,
    };
  } catch (error) {
    console.warn('[WorldLore] AI summarization failed, using fallback:', error);
    return {
      summary: buildFallbackWorldLoreSummary(normalized),
      sourceCharCount: normalized.length,
      usedAi: false,
      chunks: chunks.length,
      sampledSource,
    };
  }
}

function upsertLoreNote(
  tag: string,
  title: string,
  content: string,
  author: 'player' | 'ai',
  worldId: string,
  tags: string[]
): void {
  const store = useNotesStore.getState();
  const existing = store.notes.find(
    (note) => note.worldId === worldId && note.category === 'lore' && note.tags.includes(tag)
  );

  if (existing) {
    store.updateNote(existing.id, { title, content, author, tags, worldId, pinned: true });
    return;
  }

  store.addNote({
    title,
    content,
    category: 'lore',
    tags,
    author,
    worldId,
    pinned: true,
  });
}

export function saveWorldLoreNotes(options: SaveWorldLoreOptions): void {
  const sourceLore = normalizeLoreText(options.sourceLore);
  const summary = normalizeLoreText(options.summary);

  if (sourceLore) {
    upsertLoreNote(
      WORLD_LORE_SOURCE_TAG,
      `World Lore Source: ${options.worldName}`,
      sourceLore,
      'player',
      options.worldId,
      [WORLD_LORE_SOURCE_TAG, 'world-lore', 'canonical']
    );
  }

  if (summary) {
    upsertLoreNote(
      WORLD_LORE_SUMMARY_TAG,
      `World Lore Summary: ${options.worldName}`,
      summary,
      'ai',
      options.worldId,
      [WORLD_LORE_SUMMARY_TAG, 'world-lore', 'canonical']
    );
  }
}

export function getWorldLoreSummaryForContext(
  worldId: string,
  limit: number = WORLD_LORE_CONTEXT_CHAR_LIMIT
): string {
  const notes = getSortedNotes(useNotesStore.getState().notes)
    .filter(
      (note) =>
        note.worldId === worldId &&
        note.category === 'lore' &&
        note.tags.includes(WORLD_LORE_SUMMARY_TAG)
    );

  if (notes.length === 0) return '';

  const body = notes
    .map((note) => `## ${note.title}\n${note.content}`)
    .join('\n\n');

  return trimToBoundary(`# WORLD LORE SUMMARY\nTreat this compact summary as canonical world backstory.\n\n${body}`, limit);
}
