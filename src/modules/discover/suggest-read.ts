import 'server-only';

/**
 * Asking Claude to tag one studio photo — the call. Rules in suggest.ts.
 * The photo is fetched from its stored URL for this one reading; nothing is
 * kept but what a person then saves.
 */

import { anthropicModel, hasAnthropic } from '@/lib/env';
import { SUGGEST_PROMPT, readSuggestion, type PhotoSuggestion } from './suggest';

const API_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function canSuggestTags(): boolean {
  return hasAnthropic();
}

export async function suggestPhotoTags(url: string): Promise<PhotoSuggestion | null> {
  if (!hasAnthropic() || !/^https:\/\//.test(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const image = await fetch(url, { signal: controller.signal });
    const type = (image.headers.get('content-type') ?? '').split(';')[0]!.trim();
    if (!image.ok || !TYPES.has(type)) return null;
    const bytes = Buffer.from(await image.arrayBuffer());
    if (bytes.length > MAX_BYTES) return null;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: anthropicModel(),
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: type, data: bytes.toString('base64') } },
              { type: 'text', text: SUGGEST_PROMPT },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error('[discover-tags] reader returned', response.status);
      return null;
    }
    const json = (await response.json()) as { content?: { type: string; text?: string }[] };
    return readSuggestion((json.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n'));
  } catch (error) {
    console.error('[discover-tags] reader error', error instanceof Error ? error.name : 'unknown');
    return null;
  } finally {
    clearTimeout(timer);
  }
}
