import 'server-only';

/**
 * Reading an inspiration photo with Claude — the call. Rules in reading.ts.
 * The photo is sent for this one reading and not stored anywhere.
 */

import { anthropicModel, hasAnthropic } from '@/lib/env';
import { INSPIRATION_PROMPT, readInspiration, type InspirationResult } from './reading';

const API_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 30_000;
const IMAGES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function canReadInspiration(): boolean {
  return hasAnthropic();
}

export function readableInspirationType(type: string): boolean {
  return IMAGES.has(type);
}

export async function readInspirationPhoto(base64: string, mediaType: string): Promise<InspirationResult> {
  if (!hasAnthropic() || !IMAGES.has(mediaType)) return { ok: false, reason: 'unreadable' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: anthropicModel(),
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: INSPIRATION_PROMPT },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error('[inspiration] reader returned', response.status);
      return { ok: false, reason: 'unreadable' };
    }
    const json = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = (json.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n');
    return readInspiration(text);
  } catch (error) {
    console.error('[inspiration] reader error', error instanceof Error ? error.name : 'unknown');
    return { ok: false, reason: 'unreadable' };
  } finally {
    clearTimeout(timer);
  }
}
