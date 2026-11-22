import 'server-only';

/**
 * The petty-cash bill reader (owner, 21 Nov 2026: "photo reader … scan karke
 * samajh lega"). Same conventions as the warranty reader (aftercare/reader.ts):
 * a plain call to the Messages API, a timeout, errors reduced to a status. It
 * only adds flags; without ANTHROPIC_API_KEY or on any failure the expense is
 * saved as entered, unread.
 */

import { hasAnthropic } from '@/lib/env';
import { billPrompt, parseBillReply, type BillRead } from './rules';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
export const BILL_READER_MODEL = 'claude-sonnet-5-5';
const TIMEOUT_MS = 30_000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function readBill(photo: { mediaType: string; base64: string }): Promise<BillRead> {
  if (!hasAnthropic()) return { ok: false, why: 'not-configured' };
  if (!IMAGE_TYPES.has(photo.mediaType)) return { ok: false, why: 'not-an-image' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!.trim(), 'anthropic-version': API_VERSION },
      body: JSON.stringify({
        model: BILL_READER_MODEL,
        max_tokens: 1000,
        output_config: { effort: 'low' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: photo.mediaType, data: photo.base64 } },
              { type: 'text', text: billPrompt() },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error('[petty-cash-reader] returned', response.status);
      return { ok: false, why: 'reader-failed' };
    }
    const json = (await response.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
    if (json.stop_reason === 'refusal') return { ok: false, why: 'refused' };
    const text = (json.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
    return parseBillReply(text);
  } catch (error) {
    console.error('[petty-cash-reader] error', error instanceof Error ? (error.name === 'AbortError' ? 'timeout' : error.name) : 'unknown');
    return { ok: false, why: 'reader-failed' };
  } finally {
    clearTimeout(timer);
  }
}
